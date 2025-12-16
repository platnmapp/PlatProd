#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

@interface SharedUserDefaults : NSObject <RCTBridgeModule>
@end

@implementation SharedUserDefaults

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(setSessionData:(NSString *)sessionData) {
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.platnm.app.v2"];
    
    if (sessionData && sessionData.length > 0) {
        [sharedDefaults setObject:sessionData forKey:@"supabase_session_data"];
    } else {
        [sharedDefaults removeObjectForKey:@"supabase_session_data"];
    }
    
    [sharedDefaults synchronize];
}

RCT_EXPORT_METHOD(clearSessionData) {
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.platnm.app.v2"];
    [sharedDefaults removeObjectForKey:@"supabase_session_data"];
    [sharedDefaults synchronize];
}

@end