package kg.shop.artisan;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 101;
    private static final int CAMERA_PERMISSION_REQUEST = 102;
    private static final int STORAGE_PERMISSION_REQUEST = 103;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 104;
    private static final String APP_HOST = Uri.parse(BuildConfig.SITE_URL).getHost();

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCameraUri;
    private PermissionRequest pendingWebPermission;
    private DownloadRequest pendingDownload;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        createContentView();
        configureWebView();
        registerPredictiveBack();
        configurePushNotifications();

        if (savedInstanceState == null) {
            loadIntentOrHome(getIntent());
        } else if (webView.restoreState(savedInstanceState) == null) {
            loadIntentOrHome(getIntent());
        }
    }

    private void configureSystemBars() {
        getWindow().setStatusBarColor(Color.rgb(23, 22, 19));
        getWindow().setNavigationBarColor(Color.rgb(23, 22, 19));
    }

    private void createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 22, 19));

        webView = new WebView(this);
        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(ColorStateList.valueOf(Color.rgb(201, 101, 58)));
        progressBar.setProgressBackgroundTintList(ColorStateList.valueOf(Color.TRANSPARENT));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        );
        progressParams.gravity = Gravity.TOP;
        root.addView(progressBar, progressParams);

        setContentView(root);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setUserAgentString(
            settings.getUserAgentString() + " ArtisanAndroid/" + BuildConfig.VERSION_NAME
        );

        settings.setSafeBrowsingEnabled(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new ArtisanWebViewClient());
        webView.setWebChromeClient(new ArtisanWebChromeClient());
        webView.setDownloadListener(new ArtisanDownloadListener());
    }

    private void loadIntentOrHome(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null && intent != null) {
            String pushUrl = intent.getStringExtra("url");
            if (pushUrl != null && !pushUrl.isBlank()) {
                data = Uri.parse(pushUrl);
            }
        }
        if (data != null && isTrustedWebUrl(data)) {
            webView.loadUrl(data.toString());
            return;
        }
        webView.loadUrl(BuildConfig.SITE_URL);
    }

    private void configurePushNotifications() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            return;
        }

        PushNotificationChannels.ensure(this);
        FirebaseMessaging.getInstance().register();
        maybeRequestNotificationPermission();
    }

    private void maybeRequestNotificationPermission() {
        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED
                || PushRegistrationStore.wasPermissionPrompted(this)
        ) {
            return;
        }

        PushRegistrationStore.markPermissionPrompted(this);
        new AlertDialog.Builder(this)
            .setTitle(R.string.notification_permission_title)
            .setMessage(R.string.notification_permission_message)
            .setPositiveButton(R.string.notification_permission_allow, (dialog, which) ->
                requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
                )
            )
            .setNegativeButton(R.string.notification_permission_later, null)
            .show();
    }

    private void syncPushRegistration(WebView view, String url) {
        if (FirebaseApp.getApps(this).isEmpty()) {
            return;
        }

        Uri pageUri = Uri.parse(url);
        if (!isTrustedWebUrl(pageUri)) {
            return;
        }

        String installationId = PushRegistrationStore.getInstallationId(this);
        if (installationId.isBlank()) {
            return;
        }

        String script = "(function(){"
            + "var fid=" + JSONObject.quote(installationId) + ";"
            + "if(window.__artisanPushInstallationId===fid){return;}"
            + "fetch('/api/push/devices',{method:'POST',credentials:'same-origin',"
            + "headers:{'Content-Type':'application/json','X-Artisan-Android':'1'},"
            + "body:JSON.stringify({installationId:fid,platform:'ANDROID',appVersion:"
            + JSONObject.quote(BuildConfig.VERSION_NAME) + "})})"
            + ".then(function(response){if(response.ok){window.__artisanPushInstallationId=fid;}})"
            + ".catch(function(){});"
            + "})();";
        view.evaluateJavascript(script, null);
    }

    private boolean handleNavigation(Uri uri) {
        if (isTrustedWebUrl(uri)) {
            return false;
        }

        openExternal(uri);
        return true;
    }

    private boolean isTrustedWebUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || host == null) {
            return false;
        }
        return "https".equalsIgnoreCase(scheme)
            && (host.equalsIgnoreCase(APP_HOST) || host.endsWith("." + APP_HOST));
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent;
            if ("intent".equalsIgnoreCase(uri.getScheme())) {
                intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
            } else {
                intent = new Intent(Intent.ACTION_VIEW, uri);
            }
            startActivity(intent);
        } catch (Exception exception) {
            String fallback = uri.getQueryParameter("browser_fallback_url");
            if (fallback != null) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback)));
                } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(this, R.string.file_picker_unavailable, Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    private void requestCameraAccess(PermissionRequest request) {
        if (!isTrustedWebUrl(request.getOrigin())) {
            request.deny();
            return;
        }

        boolean asksForCamera = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                asksForCamera = true;
                break;
            }
        }

        if (!asksForCamera) {
            request.deny();
            return;
        }

        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            return;
        }

        pendingWebPermission = request;
        requestPermissions(
            new String[]{Manifest.permission.CAMERA},
            CAMERA_PERMISSION_REQUEST
        );
    }

    private boolean openFileChooser(
        ValueCallback<Uri[]> callback,
        WebChromeClient.FileChooserParams params
    ) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
        }
        fileCallback = callback;

        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType(resolvePickerType(params.getAcceptTypes()));
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);

        String[] acceptTypes = cleanAcceptTypes(params.getAcceptTypes());
        if (acceptTypes.length > 1) {
            picker.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
        }

        List<Intent> initialIntents = new ArrayList<>();
        if (acceptsImages(acceptTypes)) {
            Intent camera = createCameraIntent();
            if (camera != null) {
                initialIntents.add(camera);
            }
        }

        Intent chooser = Intent.createChooser(picker, "Выберите файл");
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents.toArray(new Intent[0]));

        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
            return true;
        } catch (ActivityNotFoundException exception) {
            fileCallback = null;
            callback.onReceiveValue(null);
            Toast.makeText(this, R.string.file_picker_unavailable, Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    private Intent createCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) {
            return null;
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "artisan-" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Artisan");
        }

        pendingCameraUri = getContentResolver().insert(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            values
        );
        if (pendingCameraUri == null) {
            return null;
        }

        camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
        camera.setClipData(ClipData.newRawUri("Artisan photo", pendingCameraUri));
        camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return camera;
    }

    private String resolvePickerType(String[] acceptTypes) {
        String[] cleaned = cleanAcceptTypes(acceptTypes);
        return cleaned.length == 1 ? cleaned[0] : "*/*";
    }

    private String[] cleanAcceptTypes(String[] acceptTypes) {
        List<String> cleaned = new ArrayList<>();
        if (acceptTypes != null) {
            for (String type : acceptTypes) {
                if (type != null) {
                    for (String item : type.split(",")) {
                        String value = normalizeMimeType(item.trim());
                        if (!value.isEmpty() && !cleaned.contains(value)) {
                            cleaned.add(value);
                        }
                    }
                }
            }
        }
        return cleaned.toArray(new String[0]);
    }

    private String normalizeMimeType(String value) {
        return switch (value.toLowerCase(Locale.ROOT)) {
            case ".pdf" -> "application/pdf";
            case ".xls" -> "application/vnd.ms-excel";
            case ".xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case ".csv" -> "text/csv";
            case ".tsv" -> "text/tab-separated-values";
            case ".txt" -> "text/plain";
            case ".doc" -> "application/msword";
            case ".docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case ".zip" -> "application/zip";
            case ".rar" -> "application/vnd.rar";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".webp" -> "image/webp";
            case ".avif" -> "image/avif";
            case ".dwg" -> "image/vnd.dwg";
            case ".dxf" -> "image/vnd.dxf";
            case ".project" -> "application/octet-stream";
            default -> value.isEmpty() ? "*/*" : value;
        };
    }

    private boolean acceptsImages(String[] acceptTypes) {
        if (acceptTypes.length == 0) {
            return false;
        }
        for (String type : acceptTypes) {
            if (type.toLowerCase(Locale.ROOT).startsWith("image/")) {
                return true;
            }
        }
        return false;
    }

    private Uri[] extractSelectedUris(Intent data) {
        if (data == null) {
            return pendingCameraUri == null ? null : new Uri[]{pendingCameraUri};
        }

        ClipData clipData = data.getClipData();
        if (clipData != null) {
            Uri[] result = new Uri[clipData.getItemCount()];
            for (int index = 0; index < clipData.getItemCount(); index++) {
                result[index] = clipData.getItemAt(index).getUri();
            }
            return result;
        }

        Uri uri = data.getData();
        return uri == null ? null : new Uri[]{uri};
    }

    private void cleanUnusedCameraUri(Uri[] result) {
        if (pendingCameraUri == null) {
            return;
        }

        boolean cameraWasUsed = result != null
            && result.length == 1
            && pendingCameraUri.equals(result[0]);
        if (!cameraWasUsed) {
            getContentResolver().delete(pendingCameraUri, null, null);
        }
        pendingCameraUri = null;
    }

    private void startDownload(DownloadRequest download) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(download.url));
            String fileName = URLUtil.guessFileName(
                download.url,
                download.contentDisposition,
                download.mimeType
            );
            request.setTitle(fileName);
            request.setDescription("Artisan");
            request.setMimeType(download.mimeType);
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.addRequestHeader("User-Agent", download.userAgent);

            String cookies = CookieManager.getInstance().getCookie(download.url);
            if (cookies != null && !cookies.isEmpty()) {
                request.addRequestHeader("Cookie", cookies);
            }

            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_LONG).show();
        } catch (Exception exception) {
            Toast.makeText(this, R.string.download_failed, Toast.LENGTH_SHORT).show();
        }
    }

    private void showOfflinePage() {
        String html = "<!doctype html><html lang=\"ru\"><head>"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
            + "<style>body{margin:0;background:#f4f1eb;color:#171613;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;padding:28px;box-sizing:border-box;text-align:center}"
            + "main{max-width:360px}div{width:64px;height:64px;margin:0 auto 24px;background:#171613;color:#fff;display:grid;place-items:center;font-size:32px;font-weight:800;border:2px solid #c9653a}"
            + "h1{font-size:24px;margin:0 0 12px}p{font-size:16px;line-height:1.5;color:#625f58;margin:0 0 24px}"
            + "a{display:inline-block;background:#171613;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700}</style></head>"
            + "<body><main><div>A</div><h1>Нет подключения</h1>"
            + "<p>Проверьте интернет и попробуйте открыть Artisan ещё раз.</p>"
            + "<a href=\"" + BuildConfig.SITE_URL + "\">Повторить</a></main></body></html>";
        webView.loadDataWithBaseURL(BuildConfig.SITE_URL, html, "text/html", "UTF-8", null);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void handleBack() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    private void registerPredictiveBack() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerPredictiveBackApi33();
        }
    }

    @SuppressLint({"NewApi", "UseRequiresApi"})
    private void registerPredictiveBackApi33() {
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            this::handleBack
        );
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            handleBack();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadIntentOrHome(intent);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (pendingWebPermission != null) {
            pendingWebPermission.deny();
            pendingWebPermission = null;
        }
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) {
            return;
        }

        Uri[] result = resultCode == RESULT_OK ? extractSelectedUris(data) : null;
        cleanUnusedCameraUri(result);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingWebPermission != null) {
            if (granted) {
                pendingWebPermission.grant(
                    new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}
                );
            } else {
                pendingWebPermission.deny();
                Toast.makeText(this, R.string.camera_permission_denied, Toast.LENGTH_LONG).show();
            }
            pendingWebPermission = null;
            return;
        }

        if (requestCode == STORAGE_PERMISSION_REQUEST && pendingDownload != null) {
            if (granted) {
                startDownload(pendingDownload);
            }
            pendingDownload = null;
        }
    }

    private final class ArtisanWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl());
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
            syncPushRegistration(view, url);
        }

        @Override
        public void onReceivedError(
            WebView view,
            WebResourceRequest request,
            WebResourceError error
        ) {
            if (request.isForMainFrame()) {
                showOfflinePage();
            }
        }

    }

    private final class ArtisanWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> requestCameraAccess(request));
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (request == pendingWebPermission) {
                pendingWebPermission = null;
            }
        }

        @Override
        public boolean onShowFileChooser(
            WebView webView,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            return openFileChooser(filePathCallback, fileChooserParams);
        }

        @Override
        public boolean onCreateWindow(
            WebView view,
            boolean isDialog,
            boolean isUserGesture,
            Message resultMsg
        ) {
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(
                    WebView popupView,
                    WebResourceRequest request
                ) {
                    Uri uri = request.getUrl();
                    popupView.destroy();
                    if (isTrustedWebUrl(uri)) {
                        webView.loadUrl(uri.toString());
                    } else {
                        openExternal(uri);
                    }
                    return true;
                }
            });

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }
    }

    private final class ArtisanDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType,
            long contentLength
        ) {
            if (url == null || !url.startsWith("https://")) {
                return;
            }

            DownloadRequest download = new DownloadRequest(
                url,
                userAgent,
                contentDisposition,
                mimeType
            );

            if (
                Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED
            ) {
                pendingDownload = download;
                requestPermissions(
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    STORAGE_PERMISSION_REQUEST
                );
                return;
            }

            startDownload(download);
        }
    }

    private static final class DownloadRequest {
        private final String url;
        private final String userAgent;
        private final String contentDisposition;
        private final String mimeType;

        private DownloadRequest(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType
        ) {
            this.url = url;
            this.userAgent = userAgent;
            this.contentDisposition = contentDisposition;
            this.mimeType = mimeType;
        }
    }
}
