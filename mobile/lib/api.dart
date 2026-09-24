// ── lib/api.dart ─────────────────────────────────────────────────
// WHAT: the ONLY file that talks HTTP. Every screen calls ApiClient —
// nobody touches http/cookies directly. Sessions are cookie-based
// (same express-session as the web app): login captures `connect.sid`,
// every later call re-sends it. Cookie persists in SharedPreferences
// so the app stays logged in across restarts.
// BASE URL: --dart-define API_BASE_URL=https://your-backend (default =
// the live Render backend, same one vercel.json proxies to).
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Thrown for every non-2xx response. [status] mirrors HTTP codes the
/// backend actually uses: 401 logged-out, 402 paywall, 429 rate limit.
class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.velosalesai.com.ng',
  );

  static const _cookieKey = 'velosalesai_session_cookie';
  String? _cookie; // raw "connect.sid=..." pair (attributes stripped)
  bool _loaded = false;



  Future<void> _ensureLoaded() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _cookie = prefs.getString(_cookieKey);
    _loaded = true;
  }

  Future<void> _saveCookie(String? raw) async {
    // Keep only the name=value pair (drop Path/HttpOnly/SameSite attrs).
    if (raw != null && raw.isNotEmpty) {
      _cookie = raw.split(';').first.trim();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cookieKey, _cookie!);
    }
  }

  Future<void> clearSession() async {
    _cookie = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cookieKey);
  }

  Map<String, String>? get _cookieHeader =>
      _cookie == null ? null : {'Cookie': _cookie!};

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        ...?_cookieHeader,
      };

  /// 401 with no usable body = session dead → wipe cookie so UI routes
  /// to login instead of looping on a zombie session.
  dynamic _decode(http.Response r) {
    if (r.statusCode == 204) return null; // e.g. DELETE product
    dynamic body;
    try {
      body = r.body.isEmpty ? {} : jsonDecode(r.body);
    } catch (_) {
      body = {};
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    if (r.statusCode == 401) unawaited(clearSession());
    final msg = body is Map && body['error'] is String
        ? body['error'] as String
        : 'Request failed (${r.statusCode})';
    throw ApiException(r.statusCode, msg);
  }

  Future<dynamic> _send(
    String method,
    String path, [
    Map<String, dynamic>? data,
  ]) async {
    await _ensureLoaded();
    final uri = Uri.parse('$baseUrl$path');
    late http.Response r;
    final h = _headers();
    if (method == 'GET') {
      r = await http.get(uri, headers: _headers(json: false));
    } else if (method == 'DELETE') {
      r = await http.delete(uri, headers: _headers(json: false));
    } else {
      final body = jsonEncode(data ?? {});
      r = method == 'PUT'
          ? await http.put(uri, headers: h, body: body)
          : await http.post(uri, headers: h, body: body);
    }
    await _saveCookie(r.headers['set-cookie']);
    return _decode(r);
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? d]) =>
      _send('POST', path, d);
  Future<dynamic> put(String path, [Map<String, dynamic>? d]) =>
      _send('PUT', path, d);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  // ── Auth (POST /api/auth/*) ──
  Future<Map<String, dynamic>> login(String email, String password) async {
    final b = await post('/api/auth/login', {
      'email': email,
      'password': password,
    });
    return (b as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> checkReferral(String code) async =>
      (await get(
              '/api/auth/check-referral?code=${Uri.encodeComponent(code.trim())}'))
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> referralStats() async =>
      (await get('/api/me/referral') as Map).cast<String, dynamic>();

  /// Refer & Earn page data: payout history + public leaderboard.
  Future<Map<String, dynamic>> referralExtra() async =>
      (await get('/api/me/referral/extra') as Map).cast<String, dynamic>();

  Future<Map<String, dynamic>> signup(
    String name,
    String email,
    String password,
    String whatsappNumber, [
    String? referralCode,
  ]) async {
    final b = await post('/api/auth/signup', {
      'name': name,
      'email': email,
      'password': password,
      'whatsapp_number': whatsappNumber,
      if (referralCode != null && referralCode.trim().isNotEmpty)
        'referral_code': referralCode.trim(),
    });
    return (b as Map).cast<String, dynamic>();
  }

  Future<void> verifyOtp(String email, String code) async {
    await post('/api/auth/verify-otp', {'email': email, 'code': code});
  }

  Future<void> resendOtp(String email) async {
    await post('/api/auth/otp-resend', {'email': email});
  }

  /// Forgot-password via CODE (option 2 next to the reset link).
  Future<Map<String, dynamic>> forgotOtp(String email) async =>
      ((await post('/api/auth/forgot-otp', {'email': email})) as Map)
          .cast<String, dynamic>();

  /// Consume a forgot-OTP code + set the new password in ONE call.
  Future<Map<String, dynamic>> resetOtp(
          String email, String code, String password) async =>
      ((await post('/api/auth/reset-otp',
                  {'email': email, 'code': code, 'password': password}))
              as Map)
          .cast<String, dynamic>();

  /// OTP fallback: "email didn't arrive? send a LINK instead" (same inbox,
  /// token flow — works even when codes land in spam).
  Future<Map<String, dynamic>> otpLink(String email) async =>
      ((await post('/api/auth/otp-link', {'email': email})) as Map)
          .cast<String, dynamic>();

  /// Forgot password: always "sent" (server never reveals who has accounts).
  Future<Map<String, dynamic>> forgot(String email) async =>
      ((await post('/api/auth/forgot', {'email': email})) as Map)
          .cast<String, dynamic>();

  /// Consume a reset-link token with a new password (link opens in browser;
  /// kept here for the day deep links land).
  Future<Map<String, dynamic>> resetPassword(
          String token, String password) async =>
      ((await post('/api/auth/reset', {'token': token, 'password': password}))
              as Map)
          .cast<String, dynamic>();

  Future<void> logout() async {
    try {
      await post('/api/auth/logout');
    } finally {
      await clearSession();
    }
  }

  // ── Owner API (GET/POST /api/me*) ──
  Future<Map<String, dynamic>> me() async =>
      (await get('/api/me') as Map).cast<String, dynamic>();

  Future<Map<String, dynamic>> billing() async =>
      (await get('/api/me/billing') as Map).cast<String, dynamic>();

  Future<List<dynamic>> products() async =>
      List<dynamic>.from(await get('/api/me/products'));

  Future<Map<String, dynamic>> catalogMeta() async =>
      (await get('/api/me/catalog-meta') as Map).cast<String, dynamic>();

  Future<Map<String, dynamic>> addProduct(
    String name,
    String price,
    String description, [
    String? imageUrl,
    String? quantity,
    String? category,
  ]) async =>
      (await post('/api/me/products', {
        'name': name,
        if (price.trim().isNotEmpty) 'price': price.trim(),
        if (description.trim().isNotEmpty)
          'description': description.trim(),
        if (quantity != null && quantity.trim().isNotEmpty)
          'quantity': quantity.trim(), // omitted when blank = keep existing on same-name updates (web parity!)
        if (category != null && category.trim().isNotEmpty)
          'category': category.trim(), // omitted when blank = preserved!
        if (imageUrl != null && imageUrl.trim().isNotEmpty)
          'image_url': imageUrl.trim(), // omitted when blank = preserve existing on same-name updates (web parity!)
      }) as Map)
          .cast<String, dynamic>();

  Future<void> deleteProduct(dynamic id) =>
      delete('/api/me/products/$id');

  /// Stock toggle: re-POST same product with flipped available.
  /// image_url OMITTED on purpose — absent key = preserve the photo (web parity!).
  Future<Map<String, dynamic>> toggleProduct(
      Map<String, dynamic> p) async =>
      (await post('/api/me/products', {
        'name': '${p['name']}',
        if (p['price'] != null) 'price': '${p['price']}',
        if (p['description'] != null)
          'description': '${p['description']}',
        'available': !(p['available'] != false),
      }) as Map)
          .cast<String, dynamic>();

  /// Remove just the photo (keeps name/price/stock — explicit null = clear!).
  Future<Map<String, dynamic>> clearProductPhoto(
      Map<String, dynamic> p) async =>
      (await post('/api/me/products', {
        'name': '${p['name']}',
        if (p['price'] != null) 'price': '${p['price']}',
        if (p['description'] != null)
          'description': '${p['description']}',
        'available': p['available'] != false,
        'image_url': null,
      }) as Map)
          .cast<String, dynamic>();

  Future<List<dynamic>> conversations() async =>
      List<dynamic>.from(await get('/api/me/conversations'));

  Future<List<dynamic>> messages(dynamic id) async =>
      List<dynamic>.from(await get('/api/me/conversations/$id/messages'));

  Future<void> takeover(dynamic id, bool paused) async {
    await post('/api/me/conversations/$id/takeover', {'paused': paused});
  }

  /// Playground test-bot: { message } → { reply } | { reply: null, reason }.
  Future<Map<String, dynamic>> playground(String message) async =>
      (await post('/api/me/playground', {'message': message}) as Map)
          .cast<String, dynamic>();

  /// VeloSales Ai chat → { reply, via, model, fallback }.
  /// history = prior bubbles oldest-first [{from: 'you'|'ai', text}…],
  /// EXCLUDING the current message (web parity: context without duplication).
  Future<Map<String, dynamic>> ask(
    String message, [
    String? model,
    List<Map<String, String>>? history,
  ]) async =>
      (await post('/api/me/ask', {
        'message': message,
        ...?model == null ? null : {'model': model},
        ...?history == null ? null : {'history': history},
      }) as Map)
          .cast<String, dynamic>();

  Future<List<dynamic>> aiModels() async {
    final b = await get('/api/me/ai-models');
    return List<dynamic>.from((b as Map)['models'] ?? []);
  }

  // ── Channel switchboard (Connect screen) ──
  // Status: WhatsApp LIVE/OFF + channel + brain pick (secrets never returned!).
  Future<Map<String, dynamic>> channels() async =>
      (await get('/api/me/channels') as Map).cast<String, dynamic>();

  /// Per-shop WhatsApp brain pick (locked → 402 ApiException → upsell sheet!).
  Future<Map<String, dynamic>> whatsappModel(String model) async =>
      (await put('/api/me/whatsapp-model', {'model': model}) as Map)
          .cast<String, dynamic>();

  /// Meta Embedded Signup: popup result (code and/or IDs) → server validates
  /// against the Graph API and stores WABA credentials against the account.
  Future<Map<String, dynamic>> metaEmbedded(
      {String? code, String? wabaId, String? phoneNumberId, String? token}) async =>
      (await post('/api/me/channels/meta/embedded', {
        if (code != null) 'code': code,
        if (wabaId != null) 'waba_id': wabaId,
        if (phoneNumberId != null) 'phone_number_id': phoneNumberId,
        if (token != null) 'token': token,
      }) as Map)
          .cast<String, dynamic>();

  /// Meta: validate ID/token → armed channel + verify token + webhook URL.
  Future<Map<String, dynamic>> metaConnect(
      String phoneNumberId, String token) async =>
      (await post('/api/me/channels/meta',
              {'phone_number_id': phoneNumberId, 'token': token}) as Map)
          .cast<String, dynamic>();

  Future<void> metaDisconnect() async {
    await post('/api/me/channels/meta/disconnect');
  }

  /// One-tap auto-sync: Meta business profile → catalog (Pro, 402 otherwise!).
  Future<Map<String, dynamic>> metaPullProfile() async =>
      (await post('/api/me/channels/meta/pull-profile') as Map)
          .cast<String, dynamic>();

  /// Telegram token save + owner link code (Connect screen reuses these!).
  Future<Map<String, dynamic>> telegramToken(String token) async =>
      (await post('/api/me/telegram/token', {'token': token}) as Map)
          .cast<String, dynamic>();

  Future<Map<String, dynamic>> telegramLink() async =>
      (await post('/api/me/telegram/link', {}) as Map)
          .cast<String, dynamic>();

  // ── Business profile (PUT /api/me/business) ──
  // Editable: name, owner_number, hours, faq, tone, currency, timezone.
  // whatsapp_number is LOCKED server-side (identity mustn't change).
  Future<Map<String, dynamic>> updateBusiness(
      Map<String, dynamic> fields) async {
    final b = await put('/api/me/business', fields);
    return (b as Map).cast<String, dynamic>();
  }

  /// Welcome setup: 5-question quiz (niche required, rest skippable).
  /// Only the setup screen calls this. Empty strings = skipped (backend
  /// stores NULL — same rule as the web quiz!).
  Future<Map<String, dynamic>> saveSetup(
    String niche,
    String heardFrom, {
    String size = '',
    List<String> channels = const [],
    String volume = '',
  }) async {
    final b = await post('/api/me/setup', {
      'business_niche': niche,
      'heard_from': heardFrom,
      if (size.isNotEmpty) 'catalog_size': size,
      if (channels.isNotEmpty) 'channels': channels,
      if (volume.isNotEmpty) 'daily_volume': volume,
    });
    return (b as Map).cast<String, dynamic>();
  }

  /// Sponsor click log (per-click billing for direct + video sponsors).
  /// Mirrors web ads.js: logged BEFORE the visit, never blocks it.
  Future<void> adClick(String slot, String url) async {
    await post('/api/me/ads/click', {'slot': slot, 'target_url': url});
  }

  // ── Bell inbox: { items: [{id,title,body,link,image_url,video_url,is_read,created_at}…],
  // unread: n }. Newest first, max 20.
  Future<Map<String, dynamic>> notifications() async =>
      (await get('/api/me/notifications') as Map).cast<String, dynamic>();

  Future<void> readNotifications() async {
    await post('/api/me/notifications/read');
  }

  /// Open ONE notification fully (detail view). Returns the row (scoped to
  /// the owner's own inbox — another shop's id 404s, same as web!).
  Future<Map<String, dynamic>> readNotification(dynamic id) async =>
      (await post('/api/me/notifications/$id/read') as Map)
          .cast<String, dynamic>();

  // ── App version (Shell update toast): { version, whatsNew }.
  Future<Map<String, dynamic>> version() async =>
      (await get('/api/version') as Map).cast<String, dynamic>();
}

// Fire-and-forget without importing dart:async everywhere.
void unawaited(Future<void> f) {}
