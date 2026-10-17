// ── lib/format.dart ──────────────────────────────────────────────
// WHAT: Dart ports of frontend/src/lib/api.js formatters — same strings
// as the web app: fmtTime '10 Sept, 14:30', fmtDate '10 Sept 2026',
// greeting() by day part. No intl dependency (manual month names).
const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'
];

DateTime? _parse(dynamic d) {
  if (d == null) return null;
  try {
    return DateTime.parse('$d').toLocal();
  } catch (_) {
    return null;
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

/// '2026-09-10T14:30…' → '10 Sept, 14:30' (inbox timestamps).
String fmtTime(dynamic d) {
  final t = _parse(d);
  if (t == null) return '—';
  return '${t.day} ${_months[t.month - 1]}, ${_two(t.hour)}:${_two(t.minute)}';
}

/// '2026-09-10T…' → '10 Sept 2026' (expiry dates).
String fmtDate(dynamic d) {
  final t = _parse(d);
  if (t == null) return '—';
  return '${t.day} ${_months[t.month - 1]} ${t.year}';
}

/// Time-based hello (Dashboard.jsx greeting()).
String greeting() {
  final h = DateTime.now().hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/// 'whatsapp:+2348031234567' → '0803 123 4567' — the same display rule as the
/// web's phone.js. Shown to the owner, so it reads like the number they know.
String prettyPhone(dynamic wa) {
  final d = '${wa ?? ''}'.replaceFirst(RegExp(r'^whatsapp:'), '');
  final ng = RegExp(r'^\+234\d{10}$');
  if (ng.hasMatch(d)) return '0${d.substring(4, 7)} ${d.substring(7, 10)} ${d.substring(10)}';
  return d.isEmpty ? '—' : d;
}

/// Trial countdown in days (Dashboard.jsx trialLeft math).
int? trialDaysLeft(dynamic trialEnds) {
  final t = _parse(trialEnds);
  if (t == null) return null;
  final days = (t.difference(DateTime.now()).inMilliseconds / 86400000).ceil();
  return days < 0 ? 0 : days;
}
