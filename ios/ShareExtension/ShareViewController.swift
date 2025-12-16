//
//  ShareViewController.swift
//  ShareExtension
//
//  Created by ADITYA MOHAN on 7/25/25.
//

import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers


// --- Data Models ---
struct Profile: Codable, Identifiable {
    let id: UUID
    let firstName: String?
    let lastName: String?
    let username: String?
    let avatarUrl: String?

    var displayName: String {
        if let first = firstName, let last = lastName, !first.isEmpty, !last.isEmpty {
            return "\(first) \(last)"
        }
        return username ?? "No name"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case username
        case avatarUrl = "avatar_url"
    }
}


struct Friendship: Codable {
    let userId: UUID
    let friendId: UUID

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case friendId = "friend_id"
    }
}

struct MusicContent: Codable {
    let title: String
    let artist: String
    let artworkURL: String
    let spotifyURL: String?
    let appleMusicURL: String?
}


class ShareViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {

    // --- UI Elements ---
    private var activityIndicator: UIActivityIndicatorView!
    private var containerView: UIView!

    // New top bar elements
    private var topDashView: UIView!
    private var platnmTitleLabel: UILabel!
    private var cancelButton: UIButton!

    private var headerView: UIView!
    private var songImageView: UIImageView!
    private var titleLabel: UILabel!
    private var artistLabel: UILabel!
    private var songInfoStackView: UIStackView!
    private var searchBar: UISearchBar!
    private var tableView: UITableView!
    private var shareButton: UIButton!

    // --- Data ---
    private var sharedURL: URL?
    private var musicContent: MusicContent?
    private var friends: [Profile] = []
    private var filteredFriends: [Profile] = []
    private var selectedFriends: Set<UUID> = []
    private var currentUserProfile: Profile?
    
    // --- Services ---
    private let supabaseService = SupabaseExtensionService()
    private var currentUserId: String?

    private enum TableSection: Int, CaseIterable {
        case addToQueue
        case shareWithFriends
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        setupUI()
        handleSharedContent()
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        view.endEditing(true)
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        searchBar.resignFirstResponder()
    }


    private func handleSharedContent() {
        showLoading(true)

        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            showErrorAndDismiss(message: "Could not read the shared item.")
            return
        }

        let urlType = UTType.url.identifier
        if itemProvider.hasItemConformingToTypeIdentifier(urlType) {
            itemProvider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] (item, error) in
                DispatchQueue.main.async {
                    guard let url = item as? URL else {
                        self?.showErrorAndDismiss(message: "Failed to get shared URL.")
                        return
                    }
                    
                    // Check if it's a Spotify or Apple Music link
                    guard let host = url.host, host.contains("spotify.com") || host.contains("music.apple.com") else {
                        self?.showErrorAndDismiss(message: "Only Spotify and Apple Music links can be shared.")
                        return
                    }
                    
                    self?.sharedURL = url
                    self?.processSharedContent(url: url.absoluteString)
                }
            }
        } else {
            showErrorAndDismiss(message: "Only URLs can be shared to Platnm.")
        }
    }
    
    private func processSharedContent(url: String) {
        Task {
            do {
                // Check if user is logged in
                guard let sessionData = supabaseService.getSessionData() else {
                    await MainActor.run {
                        self.showErrorAndDismiss(message: "You must be logged in to share music. Please open Platnm and log in.")
                    }
                    return
                }
                
                self.currentUserId = sessionData.userId
                
                // Fetch music content and friends in parallel
                async let musicContentResult = supabaseService.getMusicContent(from: url)
                async let friendsResult = supabaseService.getFriends(for: sessionData.userId)
                async let profileResult = supabaseService.getUserProfile(for: sessionData.userId)

                let (musicContent, friends, userProfile) = try await (musicContentResult, friendsResult, profileResult)
                
                await MainActor.run {
                    print("🎵 Music content loaded: \(musicContent.title) by \(musicContent.artist)")
                    print("👥 Friends loaded: \(friends.count) friends")
                    print("👤 User profile loaded: \(userProfile.displayName)")
                    
                    // Debug: Print each friend
                    for (index, friend) in friends.enumerated() {
                        print("👤 Friend \(index): \(friend.displayName) (ID: \(friend.id.uuidString))")
                    }
                    
                    self.musicContent = musicContent
                    self.friends = friends
                    self.filteredFriends = friends
                    self.currentUserProfile = userProfile
                    
                    self.updateHeader()
                    self.tableView.reloadData()
                    self.showLoading(false)
                    
                    print("✅ UI updated with \(self.friends.count) friends")
                }
                
            } catch {
                await MainActor.run {
                    self.showErrorAndDismiss(message: "Failed to load content: \(error.localizedDescription)")
                }
            }
        }
    }

    private func setupUI() {
        // Main container
        containerView = UIView()
        containerView.backgroundColor = UIColor(red: 0.055, green: 0.055, blue: 0.055, alpha: 1.0)
        // Remove this line: containerView.layer.cornerRadius = 24
        containerView.clipsToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        // Top Dash
        topDashView = UIView()
        topDashView.backgroundColor = .darkGray
        topDashView.layer.cornerRadius = 2.5
        topDashView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(topDashView)

        // Platnm Title
        platnmTitleLabel = UILabel()
        platnmTitleLabel.text = "Platnm"
        platnmTitleLabel.textColor = .white
        platnmTitleLabel.font = .boldSystemFont(ofSize: 16)
        platnmTitleLabel.textAlignment = .center
        platnmTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(platnmTitleLabel)

        // Cancel Button
        cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.gray, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 16)
        cancelButton.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(cancelButton)

        // Header (Song info)
        headerView = UIView()
        headerView.backgroundColor = UIColor(hex: "#1B1B1B")
        headerView.layer.cornerRadius = 12
        headerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(headerView)

        songImageView = UIImageView()
        songImageView.contentMode = .scaleAspectFill
        songImageView.layer.cornerRadius = 8
        songImageView.clipsToBounds = true
        songImageView.backgroundColor = .darkGray
        songImageView.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(songImageView)

        titleLabel = UILabel()
        titleLabel.textColor = .white
        titleLabel.font = .boldSystemFont(ofSize: 16)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)

        artistLabel = UILabel()
        artistLabel.textColor = .lightGray
        artistLabel.font = .systemFont(ofSize: 16)
        artistLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(artistLabel)

        songInfoStackView = UIStackView(arrangedSubviews: [titleLabel, artistLabel])
        songInfoStackView.axis = .vertical
        songInfoStackView.spacing = 4
        songInfoStackView.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(songInfoStackView)

        // Search Bar
        searchBar = UISearchBar()
        searchBar.delegate = self
        searchBar.placeholder = "Search for friends"
        searchBar.searchBarStyle = .minimal
        searchBar.searchTextField.backgroundColor = UIColor(red: 0.18, green: 0.18, blue: 0.18, alpha: 1.0)
        searchBar.searchTextField.textColor = .white
        searchBar.searchTextField.leftView?.tintColor = .lightGray
        searchBar.searchTextField.layer.cornerRadius = 18
        searchBar.searchTextField.layer.masksToBounds = true
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(searchBar)

        // Table View
        tableView = UITableView()
        tableView.dataSource = self
        tableView.delegate = self
        tableView.backgroundColor = .clear
        tableView.register(FriendCell.self, forCellReuseIdentifier: "FriendCell")
        tableView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(tableView)

        // Buttons
        shareButton = createButton(title: "Share", backgroundColor: .darkGray, titleColor: .gray, action: #selector(handleShare))
        shareButton.isEnabled = false
        containerView.addSubview(shareButton)

        // Activity Indicator
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.color = .white
        activityIndicator.hidesWhenStopped = true
        activityIndicator.center = view.center
        view.addSubview(activityIndicator)

        setupConstraints()
    }

    private func setupConstraints() {
    NSLayoutConstraint.activate([
        // Container now spans full safe area
        containerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
        containerView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
        containerView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
        containerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

        // Top Dash
        topDashView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 8),
        topDashView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
        topDashView.widthAnchor.constraint(equalToConstant: 40),
        topDashView.heightAnchor.constraint(equalToConstant: 5),

        // Platnm Title & Cancel Button
        platnmTitleLabel.topAnchor.constraint(equalTo: topDashView.bottomAnchor, constant: 16),
        platnmTitleLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
        
        cancelButton.centerYAnchor.constraint(equalTo: platnmTitleLabel.centerYAnchor),
        cancelButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),

        // Header view
        headerView.topAnchor.constraint(equalTo: platnmTitleLabel.bottomAnchor, constant: 24),
        headerView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
        headerView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
        headerView.heightAnchor.constraint(equalToConstant: 84),

        // Song image
        songImageView.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 12),
        songImageView.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
        songImageView.widthAnchor.constraint(equalToConstant: 60),
        songImageView.heightAnchor.constraint(equalToConstant: 60),
        
        // Song Info Stack View
        songInfoStackView.leadingAnchor.constraint(equalTo: songImageView.trailingAnchor, constant: 12),
        songInfoStackView.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -12),
        songInfoStackView.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

        // Search bar
        searchBar.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 16),
        searchBar.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 8),
        searchBar.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -8),
        searchBar.heightAnchor.constraint(equalToConstant: 50),

        // Table view - let it expand to fill space
        tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 8),
        tableView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
        tableView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
        tableView.bottomAnchor.constraint(equalTo: shareButton.topAnchor, constant: -16),

        // Share button
        shareButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
        shareButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
        shareButton.heightAnchor.constraint(equalToConstant: 50),
        shareButton.bottomAnchor.constraint(equalTo: containerView.safeAreaLayoutGuide.bottomAnchor, constant: -16),
    ])
}

    
    private func createButton(title: String, backgroundColor: UIColor, titleColor: UIColor, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .boldSystemFont(ofSize: 16)
        button.setTitleColor(titleColor, for: .normal)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = 25
        button.addTarget(self, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }

    private func showLoading(_ isLoading: Bool) {
        DispatchQueue.main.async {
            self.containerView.isHidden = isLoading
            if isLoading {
                self.activityIndicator.startAnimating()
            } else {
                self.activityIndicator.stopAnimating()
            }
        }
    }
    
    private func updateHeader() {
        guard let content = musicContent else { return }
        titleLabel.text = content.title
        artistLabel.text = content.artist
        
        // Load image asynchronously
        if !content.artworkURL.isEmpty, let url = URL(string: content.artworkURL) {
            Task {
                do {
                    let (data, _) = try await URLSession.shared.data(from: url)
                    if let image = UIImage(data: data) {
                        await MainActor.run {
                            self.songImageView.image = image
                        }
                    }
                } catch {
                    print("Failed to load artwork: \(error)")
                }
            }
        }
    }

    // --- Actions ---
    @objc private func handleShare() {
        guard !selectedFriends.isEmpty else {
            showErrorAndDismiss(message: "Please select at least one friend to share with.", dismiss: false)
            return
        }
        
        guard let musicContent = musicContent,
              let userId = currentUserId else {
            showErrorAndDismiss(message: "Missing necessary data to share.", dismiss: false)
            return
        }
        
        let friendIds = Array(selectedFriends.map { $0.uuidString })
        
        showLoading(true)
        Task {
            do {
                try await supabaseService.shareSong(content: musicContent, from: userId, to: friendIds)
                await MainActor.run {
                    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                }
            } catch {
                await MainActor.run {
                    self.showLoading(false)
                    self.showErrorAndDismiss(message: "Failed to share: \(error.localizedDescription)", dismiss: false)
                }
            }
        }
    }

    @objc private func handleCancel() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func updateShareButtonState() {
        if selectedFriends.isEmpty {
            shareButton.isEnabled = false
            shareButton.backgroundColor = .darkGray
            shareButton.setTitleColor(.gray, for: .normal)
        } else {
            shareButton.isEnabled = true
            shareButton.backgroundColor = .white
            shareButton.setTitleColor(.black, for: .normal)
        }
    }

    // --- UITableViewDataSource & Delegate ---
    func numberOfSections(in tableView: UITableView) -> Int {
        return TableSection.allCases.count
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        guard let sectionType = TableSection(rawValue: section) else { return 0 }
        
        switch sectionType {
        case .addToQueue:
            print("📋 Add to Queue section: returning 1 row")
            return 1
        case .shareWithFriends:
            print("👥 Share with Friends section: returning \(filteredFriends.count) rows")
            print("🔍 Filtered friends: \(filteredFriends.map { $0.displayName })")
            return filteredFriends.count
        }
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        guard let sectionType = TableSection(rawValue: section) else { return nil }
        
        switch sectionType {
        case .addToQueue:
            return "Add to Queue"
        case .shareWithFriends:
            return "Share with Friends"
        }
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let sectionType = TableSection(rawValue: indexPath.section) else {
            print("❌ Invalid section: \(indexPath.section)")
            return UITableViewCell()
        }
        
        switch sectionType {
        case .addToQueue:
            print("📋 Creating Add to Queue cell")
            let cell = tableView.dequeueReusableCell(withIdentifier: "FriendCell", for: indexPath) as! FriendCell
            if let user = currentUserProfile {
                print("👤 Configuring queue cell with user: \(user.displayName)")
                cell.configure(with: user, isSelected: selectedFriends.contains(user.id))
            } else {
                print("❌ No current user profile for queue cell")
            }
            return cell
        case .shareWithFriends:
            print("👥 Creating friend cell for row \(indexPath.row)")
            if indexPath.row >= filteredFriends.count {
                print("❌ Index out of bounds: \(indexPath.row) >= \(filteredFriends.count)")
                return UITableViewCell()
            }
            let cell = tableView.dequeueReusableCell(withIdentifier: "FriendCell", for: indexPath) as! FriendCell
            let friend = filteredFriends[indexPath.row]
            print("👤 Configuring friend cell with: \(friend.displayName)")
            cell.configure(with: friend, isSelected: selectedFriends.contains(friend.id))
            return cell
        }
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        guard let sectionType = TableSection(rawValue: indexPath.section) else { return }

        let friendId: UUID

        switch sectionType {
        case .addToQueue:
            guard let userId = currentUserProfile?.id else { return }
            friendId = userId
        case .shareWithFriends:
            friendId = filteredFriends[indexPath.row].id
        }
        
        if selectedFriends.contains(friendId) {
            selectedFriends.remove(friendId)
        } else {
            selectedFriends.insert(friendId)
        }
        tableView.reloadRows(at: [indexPath], with: .none)
        updateShareButtonState()
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 72
    }
    
    // --- UISearchBarDelegate ---
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        if searchText.isEmpty {
            filteredFriends = friends
        } else {
            filteredFriends = friends.filter { $0.displayName.lowercased().contains(searchText.lowercased()) }
        }
        tableView.reloadData()
    }
    
    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        searchBar.text = ""
        searchBar.resignFirstResponder()
        filteredFriends = friends
        tableView.reloadData()
    }
    
    // --- Helpers ---
    private func showErrorAndDismiss(message: String, dismiss: Bool = true) {
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in
            if dismiss {
                self.extensionContext?.cancelRequest(withError: NSError(domain: "com.platnm.error", code: 0, userInfo: nil))
            }
        }))
        present(alert, animated: true)
    }
}

// --- Custom TableViewCell for Friends ---
class FriendCell: UITableViewCell {
    private let profileImageView = UIImageView()
    private let nameLabel = UILabel()
    private let usernameLabel = UILabel()
    private let checkmarkView = UIImageView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCellUI()
    }

    override func layoutSubviews() {
    super.layoutSubviews()
    
    // Create a gap between cells
    contentView.frame = contentView.frame.inset(by: UIEdgeInsets(top: 4, left: 0, bottom: 4, right: 0))
}


    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupCellUI() {
        backgroundColor = .clear
        selectionStyle = .none

        // Add margin around the content view
        contentView.backgroundColor = UIColor(hex: "#0E0E0E")
        contentView.layer.cornerRadius = 16
        contentView.layer.borderWidth = 1
        contentView.clipsToBounds = true

        profileImageView.layer.cornerRadius = 20
        profileImageView.clipsToBounds = true
        profileImageView.contentMode = .scaleAspectFill
        profileImageView.backgroundColor = .darkGray
        profileImageView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(profileImageView)

        nameLabel.textColor = .white
        nameLabel.font = .systemFont(ofSize: 16, weight: .semibold)

        usernameLabel.textColor = .lightGray
        usernameLabel.font = .systemFont(ofSize: 13)
        
        let labelStackView = UIStackView(arrangedSubviews: [nameLabel, usernameLabel])
        labelStackView.axis = .vertical
        labelStackView.spacing = 2
        labelStackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(labelStackView)

        // Checkmark View
        checkmarkView.image = UIImage(systemName: "circle")
        checkmarkView.tintColor = .gray
        checkmarkView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(checkmarkView)

        NSLayoutConstraint.activate([
            profileImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            profileImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            profileImageView.widthAnchor.constraint(equalToConstant: 40),
            profileImageView.heightAnchor.constraint(equalToConstant: 40),

            labelStackView.leadingAnchor.constraint(equalTo: profileImageView.trailingAnchor, constant: 12),
            labelStackView.trailingAnchor.constraint(equalTo: checkmarkView.leadingAnchor, constant: -12),
            labelStackView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),

            checkmarkView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            checkmarkView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            checkmarkView.widthAnchor.constraint(equalToConstant: 24),
            checkmarkView.heightAnchor.constraint(equalToConstant: 24),
        ])
    }

    func configure(with friend: Profile, isSelected: Bool) {
        nameLabel.text = friend.displayName
        usernameLabel.text = friend.username.map { "@\($0)" } ?? ""

        if isSelected {
            checkmarkView.image = UIImage(systemName: "checkmark.circle.fill")
            checkmarkView.tintColor = .white
            contentView.backgroundColor = UIColor(hex: "#0E0E0E")
            contentView.layer.borderColor = UIColor.white.cgColor
        } else {
            checkmarkView.image = UIImage(systemName: "circle")
            checkmarkView.tintColor = .gray
            contentView.backgroundColor = UIColor(hex: "#0E0E0E")
            contentView.layer.borderColor = UIColor.clear.cgColor
        }

        if let avatarUrl = friend.avatarUrl, let url = URL(string: avatarUrl) {
            Task {
                do {
                    let (data, _) = try await URLSession.shared.data(from: url)
                    if let image = UIImage(data: data) {
                        await MainActor.run {
                            self.profileImageView.image = image
                        }
                    }
                } catch {
                    print("Failed to load profile image: \(error)")
                }
            }
        } else {
            profileImageView.image = nil
        }
    }
}

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int = UInt64()
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: CGFloat(a) / 255)
    }
}

