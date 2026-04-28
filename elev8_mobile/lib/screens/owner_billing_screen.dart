import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../models/owner_billing.dart';
import '../services/owner_api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

final billingMetricsProvider = FutureProvider<BillingMetrics>((ref) async {
  return OwnerApiService.fetchBillingMetrics();
});

final billingCustomersProvider =
    FutureProvider<List<BillingCustomer>>((ref) async {
  return OwnerApiService.fetchBillingCustomers(limit: 10);
});

final billingTransactionsProvider =
    FutureProvider<List<BillingTransaction>>((ref) async {
  return OwnerApiService.fetchBillingTransactions(limit: 50);
});

/// Owner-only Billing screen.
///
/// Read-only first cut — three sections (metrics / top customers /
/// recent transactions) backed by independent providers so each
/// section shows its own loading + error state.
class OwnerBillingScreen extends ConsumerWidget {
  const OwnerBillingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                ref.invalidate(billingMetricsProvider);
                ref.invalidate(billingCustomersProvider);
                ref.invalidate(billingTransactionsProvider);
                await Future.wait([
                  ref.read(billingMetricsProvider.future),
                  ref.read(billingCustomersProvider.future),
                  ref.read(billingTransactionsProvider.future),
                ]);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  Text('MANAGEMENT', style: AppText.eyebrow),
                  const SizedBox(height: 4),
                  Text('Billing', style: AppText.screenTitle),
                  const SizedBox(height: 6),
                  Text(
                    'Subscription health, top customers, and recent activity.',
                    style: AppText.label,
                  ),
                  const SizedBox(height: 16),
                  const _MetricsSection(),
                  const SizedBox(height: 24),
                  const _CustomersSection(),
                  const SizedBox(height: 24),
                  const _TransactionsSection(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────

class _MetricsSection extends ConsumerWidget {
  const _MetricsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(billingMetricsProvider);
    return async.when(
      loading: () => const _SectionLoading(label: 'Loading metrics…'),
      error: (e, _) => _SectionError(message: e.toString()),
      data: _Metrics.new,
    );
  }
}

class _Metrics extends StatelessWidget {
  final BillingMetrics metrics;
  const _Metrics(this.metrics);

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    final pct = NumberFormat.percentPattern();
    final tiles = <_MetricTile>[
      _MetricTile(
        icon: Icons.trending_up,
        label: 'MRR',
        value: cur.format(metrics.mrr),
        color: AppColors.accent,
      ),
      _MetricTile(
        icon: Icons.calendar_today_outlined,
        label: 'ARR',
        value: cur.format(metrics.arr),
        color: AppColors.accentDeep,
      ),
      _MetricTile(
        icon: Icons.attach_money,
        label: 'LTV',
        value: cur.format(metrics.ltv),
        color: AppColors.emeraldAccent,
      ),
      _MetricTile(
        icon: Icons.people_outline,
        label: 'Active subs',
        value: metrics.activeSubscriptions.toString(),
        color: AppColors.cyanAccent,
      ),
      _MetricTile(
        icon: Icons.group_outlined,
        label: 'Customers',
        value: metrics.totalCustomers.toString(),
        color: AppColors.accent,
      ),
      _MetricTile(
        icon: Icons.show_chart,
        label: 'Churn',
        value: pct.format(metrics.churnRate / 100),
        color: metrics.churnRate > 5 ? Colors.redAccent : Colors.green,
      ),
      _MetricTile(
        icon: Icons.account_balance,
        label: 'Total revenue',
        value: cur.format(metrics.totalRevenue),
        color: AppColors.accentDeep,
        wide: true,
      ),
    ];

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final t in tiles)
          SizedBox(
            width: t.wide
                ? double.infinity
                : (MediaQuery.of(context).size.width - 20 * 2 - 12) / 2,
            child: t,
          ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool wide;

  const _MetricTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.wide = false,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: AppText.eyebrow,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: AppText.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Customers ────────────────────────────────────────────────────────────

class _CustomersSection extends ConsumerWidget {
  const _CustomersSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(billingCustomersProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('TOP CUSTOMERS', style: AppText.eyebrow),
        const SizedBox(height: 8),
        async.when(
          loading: () => const _SectionLoading(label: 'Loading customers…'),
          error: (e, _) => _SectionError(message: e.toString()),
          data: (customers) {
            if (customers.isEmpty) {
              return const _EmptyHint(
                icon: Icons.people_outline,
                message: 'No customers yet.',
              );
            }
            return Column(
              children: [for (final c in customers) _CustomerCard(customer: c)],
            );
          },
        ),
      ],
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final BillingCustomer customer;
  const _CustomerCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: () => _showCustomerSheet(context, customer),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    customer.displayName,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (customer.email.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      customer.email,
                      style: AppText.caption,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  _StatusPill(status: customer.subscriptionStatus),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  cur.format(customer.totalSpent),
                  style: AppText.value.copyWith(color: AppColors.accent),
                ),
                const SizedBox(height: 2),
                Text(
                  '${cur.format(customer.subscriptionAmount)}/mo',
                  style: AppText.caption,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    if (status.isEmpty) return const SizedBox.shrink();
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'active':
      return Colors.green;
    case 'trialing':
      return AppColors.cyanAccent;
    case 'past_due':
    case 'unpaid':
      return Colors.orange;
    case 'canceled':
    case 'cancelled':
    case 'incomplete_expired':
      return Colors.redAccent;
    default:
      return AppColors.textMutedOnGlass;
  }
}

void _showCustomerSheet(BuildContext context, BillingCustomer c) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _CustomerDetailSheet(customer: c),
  );
}

class _CustomerDetailSheet extends StatelessWidget {
  final BillingCustomer customer;
  const _CustomerDetailSheet({required this.customer});

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.simpleCurrency();
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
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
            Text(customer.displayName, style: AppText.cardTitle),
            if (customer.email.isNotEmpty)
              Text(customer.email, style: AppText.caption),
            const SizedBox(height: 20),
            _Detail('Total spent', cur.format(customer.totalSpent)),
            _Detail(
              'Subscription',
              '${cur.format(customer.subscriptionAmount)}/mo',
            ),
            _Detail('Status', customer.subscriptionStatus),
            _Detail('Customer since', _prettyDate(customer.createdAt)),
            _Detail('Stripe ID', customer.id),
          ],
        ),
      ),
    );
  }
}

// ── Transactions ─────────────────────────────────────────────────────────

class _TransactionsSection extends ConsumerWidget {
  const _TransactionsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(billingTransactionsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('RECENT ACTIVITY', style: AppText.eyebrow),
        const SizedBox(height: 8),
        async.when(
          loading: () =>
              const _SectionLoading(label: 'Loading transactions…'),
          error: (e, _) => _SectionError(message: e.toString()),
          data: (txs) {
            if (txs.isEmpty) {
              return const _EmptyHint(
                icon: Icons.receipt_long_outlined,
                message: 'No transactions in the last 50 events.',
              );
            }
            return Column(
              children: [for (final t in txs) _TransactionCard(transaction: t)],
            );
          },
        ),
      ],
    );
  }
}

class _TransactionCard extends StatelessWidget {
  final BillingTransaction transaction;
  const _TransactionCard({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final t = transaction;
    final cur = NumberFormat.simpleCurrency(name: t.currency.toUpperCase());
    final amount = cur.format(t.amount);
    final accent = t.isRefund ? Colors.orange : Colors.green;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        onTap: () => _showTransactionSheet(context, t),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                t.isRefund ? Icons.undo : Icons.payments_outlined,
                size: 18,
                color: accent,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.customerName.isNotEmpty
                        ? t.customerName
                        : t.customerEmail.isNotEmpty
                              ? t.customerEmail
                              : t.description,
                    style: AppText.value,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _prettyDateTime(t.createdAt) ?? '—',
                    style: AppText.caption,
                  ),
                ],
              ),
            ),
            Text(
              '${t.isRefund ? '-' : ''}$amount',
              style: AppText.value.copyWith(color: accent),
            ),
          ],
        ),
      ),
    );
  }
}

void _showTransactionSheet(BuildContext context, BillingTransaction t) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _TransactionDetailSheet(transaction: t),
  );
}

class _TransactionDetailSheet extends StatelessWidget {
  final BillingTransaction transaction;
  const _TransactionDetailSheet({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final t = transaction;
    final cur = NumberFormat.simpleCurrency(name: t.currency.toUpperCase());
    final accent = t.isRefund ? Colors.orange : Colors.green;
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
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
            Row(
              children: [
                Icon(
                  t.isRefund ? Icons.undo : Icons.payments_outlined,
                  color: accent,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    t.isRefund ? 'Refund' : 'Payment',
                    style: AppText.cardTitle,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _prettyDateTime(t.createdAt) ?? '—',
              style: AppText.caption,
            ),
            const SizedBox(height: 20),
            _Detail(
              'Amount',
              '${t.isRefund ? '-' : ''}${cur.format(t.amount)}',
            ),
            _Detail('Status', t.status),
            _Detail(
              'Customer',
              t.customerName.isNotEmpty ? t.customerName : null,
            ),
            _Detail('Email', t.customerEmail),
            if (t.description.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Description', style: AppText.eyebrow),
              const SizedBox(height: 4),
              Text(t.description, style: AppText.label),
            ],
            const SizedBox(height: 12),
            _Detail('Stripe ID', t.id),
          ],
        ),
      ),
    );
  }
}

// ── Shared bits ──────────────────────────────────────────────────────────

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

class _SectionLoading extends StatelessWidget {
  final String label;
  const _SectionLoading({required this.label});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.accent,
            ),
          ),
          const SizedBox(width: 12),
          Text(label, style: AppText.label),
        ],
      ),
    );
  }
}

class _SectionError extends StatelessWidget {
  final String message;
  const _SectionError({required this.message});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent),
          const SizedBox(height: 6),
          Text("Couldn't load this section", style: AppText.cardTitle),
          const SizedBox(height: 4),
          Text(message, style: AppText.caption),
        ],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyHint({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        children: [
          Icon(icon, color: AppColors.textMutedOnGlass),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: AppText.label)),
        ],
      ),
    );
  }
}

String? _prettyDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return DateFormat('MMM d, yyyy').format(dt);
}

String? _prettyDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return DateFormat('MMM d, yyyy · h:mm a').format(dt.toLocal());
}
