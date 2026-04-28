import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/owner_payroll_entry.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final ownerPayrollProvider =
    FutureProvider<List<OwnerPayrollEntry>>((ref) async {
  return OwnerApiService.fetchPayrollEntries();
});

/// Owner-only Payroll screen.
///
/// Read-only first cut — lists every payroll_entries row grouped by
/// week-ending date with running totals across the page.
class OwnerPayrollScreen extends ConsumerStatefulWidget {
  const OwnerPayrollScreen({super.key});

  @override
  ConsumerState<OwnerPayrollScreen> createState() =>
      _OwnerPayrollScreenState();
}

class _OwnerPayrollScreenState extends ConsumerState<OwnerPayrollScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ownerPayrollProvider);
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(ownerPayrollProvider);
                await ref.read(ownerPayrollProvider.future);
              },
              child: async.when(
                loading: () => const _LoadingState(),
                error: (e, _) => _ErrorState(message: e.toString()),
                data: (entries) => _Loaded(
                  entries: entries,
                  query: _query,
                  onQueryChanged: (q) => setState(() => _query = q),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    children: const [
      SizedBox(height: 200),
      Center(child: CircularProgressIndicator(color: AppColors.accent)),
    ],
  );
}

class _ErrorState extends StatelessWidget {
  final String message;
  const _ErrorState({required this.message});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 80),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent),
              const SizedBox(height: 8),
              Text("Couldn't load payroll", style: AppText.cardTitle),
              const SizedBox(height: 6),
              Text(message, style: AppText.label),
            ],
          ),
        ),
      ],
    );
  }
}

class _Loaded extends StatelessWidget {
  final List<OwnerPayrollEntry> entries;
  final String query;
  final ValueChanged<String> onQueryChanged;

  const _Loaded({
    required this.entries,
    required this.query,
    required this.onQueryChanged,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _filter(entries, query);
    final grouped = _groupByWeek(filtered);
    final totalPaid = filtered.fold<double>(0, (a, e) => a + e.totalPay);
    final totalHours = filtered.fold<double>(0, (a, e) => a + e.totalHours);
    final cur = NumberFormat.simpleCurrency();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('MANAGEMENT', style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text('Payroll', style: AppText.screenTitle),
        const SizedBox(height: 6),
        Text(
          '${entries.length} ${entries.length == 1 ? "entry" : "entries"} '
          'on record',
          style: AppText.label,
        ),
        const SizedBox(height: 16),
        _SummaryCard(
          totalPaid: cur.format(totalPaid),
          totalHours: '${totalHours.toStringAsFixed(1)} hrs',
          entryCount: filtered.length,
        ),
        const SizedBox(height: 16),
        _SearchField(value: query, onChanged: onQueryChanged),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          _EmptyResults(hasQuery: query.isNotEmpty)
        else
          for (final group in grouped) ...[
            _WeekHeader(weekEnding: group.weekEnding, totals: group),
            for (final entry in group.entries) _EntryCard(entry: entry),
            const SizedBox(height: 4),
          ],
      ],
    );
  }

  static List<OwnerPayrollEntry> _filter(
    List<OwnerPayrollEntry> rows,
    String q,
  ) {
    if (q.trim().isEmpty) return rows;
    final needle = q.trim().toLowerCase();
    return rows.where((e) {
      return e.staffName.toLowerCase().contains(needle) ||
          e.weekEndingDate.contains(needle) ||
          e.notes.toLowerCase().contains(needle);
    }).toList();
  }

  static List<_WeekGroup> _groupByWeek(List<OwnerPayrollEntry> rows) {
    final byWeek = <String, List<OwnerPayrollEntry>>{};
    for (final e in rows) {
      byWeek.putIfAbsent(e.weekEndingDate, () => []).add(e);
    }
    final keys = byWeek.keys.toList()
      ..sort((a, b) => b.compareTo(a)); // newest first
    return [
      for (final k in keys)
        _WeekGroup(
          weekEnding: k,
          entries: byWeek[k]!,
        ),
    ];
  }
}

class _WeekGroup {
  final String weekEnding;
  final List<OwnerPayrollEntry> entries;

  _WeekGroup({required this.weekEnding, required this.entries});

  double get totalPay => entries.fold(0, (a, e) => a + e.totalPay);
  double get totalHours => entries.fold(0, (a, e) => a + e.totalHours);
}

// ── Summary card ─────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  final String totalPaid;
  final String totalHours;
  final int entryCount;

  const _SummaryCard({
    required this.totalPaid,
    required this.totalHours,
    required this.entryCount,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          Expanded(
            child: _Stat(label: 'TOTAL PAID', value: totalPaid),
          ),
          Container(
            width: 1,
            height: 40,
            color: AppColors.glassBorder,
            margin: const EdgeInsets.symmetric(horizontal: 8),
          ),
          Expanded(
            child: _Stat(label: 'TOTAL HOURS', value: totalHours),
          ),
          Container(
            width: 1,
            height: 40,
            color: AppColors.glassBorder,
            margin: const EdgeInsets.symmetric(horizontal: 8),
          ),
          Expanded(
            child: _Stat(label: 'ENTRIES', value: entryCount.toString()),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.eyebrow),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppText.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

// ── Search ───────────────────────────────────────────────────────────────

class _SearchField extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _SearchField({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: 'Search by staff, week, notes',
        hintStyle: AppText.label,
        prefixIcon: const Icon(Icons.search, color: Colors.black45),
        filled: true,
        fillColor: AppColors.glassFill,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.glassBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
      ),
    );
  }
}

class _EmptyResults extends StatelessWidget {
  final bool hasQuery;
  const _EmptyResults({required this.hasQuery});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          const Icon(
            Icons.account_balance_wallet_outlined,
            size: 36,
            color: AppColors.textMutedOnGlass,
          ),
          const SizedBox(height: 8),
          Text(
            hasQuery ? 'No matches' : 'No payroll entries yet',
            style: AppText.cardTitle,
          ),
          const SizedBox(height: 4),
          Text(
            hasQuery
                ? 'Try a different staff name or week.'
                : 'Add the first entry on the web app.',
            style: AppText.label,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Week header + entry card ─────────────────────────────────────────────

class _WeekHeader extends StatelessWidget {
  final String weekEnding;
  final _WeekGroup totals;

  const _WeekHeader({required this.weekEnding, required this.totals});

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'WEEK ENDING',
                  style: AppText.eyebrow,
                ),
                const SizedBox(height: 2),
                Text(
                  _prettyDate(weekEnding) ?? weekEnding,
                  style: AppText.value,
                ),
              ],
            ),
          ),
          Text(
            cur.format(totals.totalPay),
            style: AppText.value.copyWith(color: AppColors.accent),
          ),
        ],
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final OwnerPayrollEntry entry;
  const _EntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: () => _showEntrySheet(context, entry),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.staffName.isEmpty ? 'Unnamed' : entry.staffName,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _hoursLine(entry),
                    style: AppText.caption,
                  ),
                  if (entry.isPaid) ...[
                    const SizedBox(height: 6),
                    _PaidPill(payDate: entry.payDate!),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  cur.format(entry.totalPay),
                  style: AppText.value.copyWith(color: AppColors.accent),
                ),
                const SizedBox(height: 2),
                Text(
                  '${entry.totalHours.toStringAsFixed(1)} hrs',
                  style: AppText.caption,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _hoursLine(OwnerPayrollEntry e) {
    final pieces = <String>[];
    if (e.coachingHours > 0) {
      pieces.add('${e.coachingHours.toStringAsFixed(1)} coaching');
    }
    if (e.officeHours > 0) {
      pieces.add('${e.officeHours.toStringAsFixed(1)} office');
    }
    return pieces.isEmpty ? '0 hrs' : pieces.join(' · ');
  }
}

class _PaidPill extends StatelessWidget {
  final String payDate;
  const _PaidPill({required this.payDate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle, size: 12, color: Colors.green),
          const SizedBox(width: 4),
          Text(
            'Paid ${_prettyDate(payDate) ?? payDate}',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.green,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail sheet ─────────────────────────────────────────────────────────

void _showEntrySheet(BuildContext context, OwnerPayrollEntry entry) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _EntryDetailSheet(entry: entry),
  );
}

class _EntryDetailSheet extends StatelessWidget {
  final OwnerPayrollEntry entry;
  const _EntryDetailSheet({required this.entry});

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: AppColors.glassFill,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              entry.staffName.isEmpty ? 'Unnamed' : entry.staffName,
              style: AppText.cardTitle,
            ),
            Text(
              'Week ending ${_prettyDate(entry.weekEndingDate) ?? entry.weekEndingDate}',
              style: AppText.caption,
            ),
            const SizedBox(height: 20),
            _Detail('Total pay', cur.format(entry.totalPay)),
            _Detail(
              'Coaching hours',
              '${entry.coachingHours.toStringAsFixed(1)} hrs',
            ),
            _Detail(
              'Office hours',
              '${entry.officeHours.toStringAsFixed(1)} hrs',
            ),
            _Detail(
              'Total hours',
              '${entry.totalHours.toStringAsFixed(1)} hrs',
            ),
            _Detail(
              'Paid on',
              entry.isPaid ? _prettyDate(entry.payDate) : 'Not yet paid',
            ),
            if (entry.notes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Notes', style: AppText.eyebrow),
              const SizedBox(height: 4),
              Text(entry.notes, style: AppText.label),
            ],
            const SizedBox(height: 16),
            Text(
              'Payroll edits are managed on the web app for now.',
              style: AppText.caption,
            ),
          ],
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  final String label;
  final String? value;
  const _Detail(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final shown = (value == null || value!.trim().isEmpty) ? '—' : value!;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: AppText.label)),
          Expanded(child: Text(shown, style: AppText.value)),
        ],
      ),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

String? _prettyDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return DateFormat('MMM d, yyyy').format(dt);
}
