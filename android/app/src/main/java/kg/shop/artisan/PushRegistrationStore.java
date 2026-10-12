package kg.shop.artisan;

import android.content.Context;
import android.content.SharedPreferences;

final class PushRegistrationStore {
    private static final String PREFERENCES = "artisan_push";
    private static final String INSTALLATION_ID = "installation_id";
    private static final String PERMISSION_PROMPTED = "permission_prompted";

    private PushRegistrationStore() {}

    static void saveInstallationId(Context context, String installationId) {
        preferences(context).edit().putString(INSTALLATION_ID, installationId).apply();
    }

    static String getInstallationId(Context context) {
        return preferences(context).getString(INSTALLATION_ID, "");
    }

    static void clearInstallationId(Context context, String installationId) {
        SharedPreferences preferences = preferences(context);
        String current = preferences.getString(INSTALLATION_ID, "");
        if (current.equals(installationId)) {
            preferences.edit().remove(INSTALLATION_ID).apply();
        }
    }

    static boolean wasPermissionPrompted(Context context) {
        return preferences(context).getBoolean(PERMISSION_PROMPTED, false);
    }

    static void markPermissionPrompted(Context context) {
        preferences(context).edit().putBoolean(PERMISSION_PROMPTED, true).apply();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
