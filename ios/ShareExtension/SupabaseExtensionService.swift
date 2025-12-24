import Foundation
import Supabase

struct SessionData: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int
    let userId: String
    let expiresIn: Int
    
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case userId = "user_id"
        case expiresIn = "expires_in"
    }
    
    var isExpired: Bool {
        let currentTime = Int(Date().timeIntervalSince1970)
        return currentTime >= expiresAt
    }
}

class SupabaseExtensionService {
    private let supabaseUrl = "https://uirmafqpkulwkkpyfmrj.supabase.co"
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpcm1hZnFwa3Vsd2trcHlmbXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDEwMjMsImV4cCI6MjA4MDM3NzAyM30.OwH5ZtpySBNAXaV4-C1Am1-oLJi42RoXc_3yqgQo-PI"
    private let appGroupId = "group.com.platnm.app.v2"
    
    private lazy var supabaseClient: SupabaseClient = {
        return SupabaseClient(
            supabaseURL: URL(string: supabaseUrl)!,
            supabaseKey: supabaseAnonKey
        )
    }()
    
    // MARK: - Session Management
    
    func getSessionData() -> SessionData? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupId) else {
            print("❌ No session data found in shared storage - could not access UserDefaults")
            return nil
        }
        
        guard let sessionDataString = sharedDefaults.string(forKey: "supabase_session_data") else {
            print("❌ No session data found in shared storage - no data for key 'supabase_session_data'")
            // Debug: let's see what keys ARE available
            print("🔍 Available keys in shared defaults:", sharedDefaults.dictionaryRepresentation().keys)
            return nil
        }
        
        guard let sessionDataData = sessionDataString.data(using: .utf8) else {
            print("❌ Could not convert session data string to data")
            return nil
        }
        
        do {
            let sessionData = try JSONDecoder().decode(SessionData.self, from: sessionDataData)
            print("✅ Successfully decoded session data for user:", sessionData.userId)
            print("🔍 Session expires at:", Date(timeIntervalSince1970: TimeInterval(sessionData.expiresAt)))
            print("🔍 Is expired:", sessionData.isExpired)
            return sessionData
        } catch {
            print("❌ Failed to decode session data:", error)
            print("🔍 Raw session string:", sessionDataString)
            return nil
        }
    }
    
    func setupSession() async -> Bool {
        print("🔐 Setting up session...")
        
        guard let sessionData = getSessionData() else {
            print("❌ No valid session data available")
            return false
        }
        
        print("✅ Session data found for user: \(sessionData.userId)")
        print("🕒 Session expires at: \(Date(timeIntervalSince1970: TimeInterval(sessionData.expiresAt)))")
        print("⏰ Current time: \(Date())")
        print("🔍 Is expired: \(sessionData.isExpired)")
        
        if sessionData.isExpired {
            print("⚠️ Session is expired, attempting refresh...")
            let refreshResult = await refreshSession(sessionData)
            print("🔄 Refresh result: \(refreshResult)")
            return refreshResult
        }
        
        // Set the session tokens in the Supabase client
        do {
            print("🔑 Setting session tokens in Supabase client...")
            try await supabaseClient.auth.setSession(
                accessToken: sessionData.accessToken,
                refreshToken: sessionData.refreshToken
            )
            print("✅ Session successfully set in Supabase client")
            return true
        } catch {
            print("❌ Failed to set session: \(error)")
            return false
        }
    }
    
    private func refreshSession(_ sessionData: SessionData) async -> Bool {
        do {
            let session = try await supabaseClient.auth.refreshSession(refreshToken: sessionData.refreshToken)
            
            // Calculate expiry time safely
            let currentTime = Date()
            let expiryTime = currentTime.addingTimeInterval(session.expiresIn)
            
            // Update the shared storage with new session data
            let newSessionData = SessionData(
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
                expiresAt: Int(expiryTime.timeIntervalSince1970),
                userId: sessionData.userId,
                expiresIn: Int(session.expiresIn)
            )
            
            if let newSessionDataJson = try? JSONEncoder().encode(newSessionData),
               let newSessionDataString = String(data: newSessionDataJson, encoding: .utf8),
               let sharedDefaults = UserDefaults(suiteName: appGroupId) {
                sharedDefaults.set(newSessionDataString, forKey: "supabase_session_data")
            }
            
            return true
        } catch {
            print("Failed to refresh session: \(error)")
            return false
        }
    }
    
    // MARK: - API Calls
    
    func getFriends(for userId: String) async throws -> [Profile] {
        print("🔍 getFriends called for userId: \(userId)")
        
        guard await setupSession() else {
            print("❌ Authentication failed in getFriends")
            throw NSError(domain: "SupabaseExtensionService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }
        
        print("✅ Authentication successful, fetching friendships...")

        // Get friendships where user is either sender or receiver
        let friendships: [Friendship] = try await supabaseClient
            .from("friendships")
            .select()
            .or("user_id.eq.\(userId),friend_id.eq.\(userId)")
            .eq("status", value: "accepted")
            .execute()
            .value

        print("📊 Found \(friendships.count) friendships")
        
        // Debug: Print all friendships
        for (index, friendship) in friendships.enumerated() {
            print("🔍 Friendship \(index): user_id=\(friendship.userId.uuidString), friend_id=\(friendship.friendId.uuidString)")
        }

        // Extract friend IDs correctly - the friend is whoever ISN'T the current user
        let friendIds = friendships.compactMap { friendship -> String? in
            let userIdString = friendship.userId.uuidString.lowercased()
            let friendIdString = friendship.friendId.uuidString.lowercased()
            let currentUserIdLower = userId.lowercased()
            
            print("🔍 Comparing: userIdString=\(userIdString), friendIdString=\(friendIdString), currentUserId=\(currentUserIdLower)")
            
            if userIdString == currentUserIdLower {
                print("✅ Match found: returning friend_id \(friendIdString)")
                return friendship.friendId.uuidString
            } else if friendIdString == currentUserIdLower {
                print("✅ Match found: returning user_id \(userIdString)")
                return friendship.userId.uuidString
            }
            
            print("❌ No match for this friendship")
            return nil
        }
        
        print("📊 Extracted \(friendIds.count) friend IDs: \(friendIds)")
        
        if friendIds.isEmpty {
            print("⚠️ No friend IDs found, returning empty array")
            return []
        }

        // Get friend profiles
        print("🔍 Fetching friend profiles for IDs: \(friendIds)")
        let profiles: [Profile] = try await supabaseClient
            .from("profiles")
            .select()
            .in("id", values: friendIds)
            .execute()
            .value

        print("✅ Successfully fetched \(profiles.count) friend profiles")
        
        // Debug: Print profile details
        for (index, profile) in profiles.enumerated() {
            print("👤 Profile \(index): id=\(profile.id.uuidString), name=\(profile.displayName)")
        }

        return profiles
    }
  
    func getUserProfile(for userId: String) async throws -> Profile {
        guard await setupSession() else {
            throw NSError(domain: "SupabaseExtensionService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }

        let profile: Profile = try await supabaseClient
            .from("profiles")
            .select()
            .eq("id", value: userId)
            .single()
            .execute()
            .value
            
        return profile
    }

    
    func shareSong(content: MusicContent, from userId: String, to friendIds: [String]) async throws {
        guard await setupSession() else {
            throw NSError(domain: "SupabaseExtensionService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }
        
        let shareItems = friendIds.map { friendId in
            SharedSongInsert(
                senderId: userId,
                receiverId: friendId,
                songId: extractSongId(from: content),
                songTitle: content.title,
                songArtist: content.artist,
                songAlbum: nil, // We don't have album info in MusicContent
                songArtwork: content.artworkURL,
                service: content.spotifyURL != nil ? "spotify" : "apple",
                externalUrl: content.spotifyURL ?? content.appleMusicURL,
                isQueued: userId == friendId
            )
        }
        
        try await supabaseClient
            .from("shared_songs")
            .upsert(shareItems)
            .execute()
    }
    
    private func extractSongId(from content: MusicContent) -> String {
        // Extract song ID from URL
        if let spotifyUrl = content.spotifyURL {
            if let trackIdMatch = spotifyUrl.range(of: "track/([a-zA-Z0-9]+)", options: .regularExpression) {
                return String(spotifyUrl[trackIdMatch]).replacingOccurrences(of: "track/", with: "")
            }
        }
        
        if let appleMusicUrl = content.appleMusicURL {
            // Extract Apple Music ID (this is more complex, but let's use a simple approach)
            if let idMatch = appleMusicUrl.range(of: "/([0-9]+)", options: .regularExpression) {
                return String(appleMusicUrl[idMatch]).replacingOccurrences(of: "/", with: "")
            }
        }
        
        // Fallback to URL itself if we can't extract ID
        return content.spotifyURL ?? content.appleMusicURL ?? "unknown"
    }
    
    func getMusicContent(from urlString: String) async throws -> MusicContent {
        // Make direct HTTP call to the edge function
        guard let url = URL(string: "\(supabaseUrl)/functions/v1/process-music-link") else {
            throw NSError(domain: "SupabaseExtensionService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid function URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        
        let parameters = ["link": urlString]
        request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
        
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "SupabaseExtensionService", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch music content"])
        }
        
        let musicContent = try JSONDecoder().decode(MusicContent.self, from: data)
        return musicContent
    }
}

// Helper struct for database insertion
struct SharedSongInsert: Codable {
    let senderId: String
    let receiverId: String
    let songId: String
    let songTitle: String
    let songArtist: String
    let songAlbum: String?
    let songArtwork: String
    let service: String
    let externalUrl: String?
    let isQueued: Bool

    enum CodingKeys: String, CodingKey {
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case songId = "song_id"
        case songTitle = "song_title"
        case songArtist = "song_artist"
        case songAlbum = "song_album"
        case songArtwork = "song_artwork"
        case service
        case externalUrl = "external_url"
        case isQueued = "is_queued"
    }
}
