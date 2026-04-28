/// Top-level billing metrics returned by /api/owner/billing/metrics.
class BillingMetrics {
  final double mrr;
  final double arr;
  final double ltv;
  final int activeSubscriptions;
  final int totalCustomers;
  final double churnRate;
  final double totalRevenue;
  final String? timestamp;

  const BillingMetrics({
    required this.mrr,
    required this.arr,
    required this.ltv,
    required this.activeSubscriptions,
    required this.totalCustomers,
    required this.churnRate,
    required this.totalRevenue,
    required this.timestamp,
  });

  factory BillingMetrics.fromJson(Map<String, dynamic> json) {
    double parseDouble(Object? v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }

    int parseInt(Object? v) {
      if (v == null) return 0;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString()) ?? 0;
    }

    return BillingMetrics(
      mrr: parseDouble(json['mrr']),
      arr: parseDouble(json['arr']),
      ltv: parseDouble(json['ltv']),
      activeSubscriptions: parseInt(json['active_subscriptions']),
      totalCustomers: parseInt(json['total_customers']),
      churnRate: parseDouble(json['churn_rate']),
      totalRevenue: parseDouble(json['total_revenue']),
      timestamp: json['timestamp'] as String?,
    );
  }
}

/// One row from /api/owner/billing/customers.
class BillingCustomer {
  final String id;
  final String email;
  final String name;
  final double totalSpent;
  final String subscriptionStatus;
  final double subscriptionAmount;
  final String? createdAt;

  const BillingCustomer({
    required this.id,
    required this.email,
    required this.name,
    required this.totalSpent,
    required this.subscriptionStatus,
    required this.subscriptionAmount,
    required this.createdAt,
  });

  String get displayName {
    final n = name.trim();
    if (n.isNotEmpty) return n;
    if (email.isNotEmpty) {
      final at = email.indexOf('@');
      return at > 0 ? email.substring(0, at) : email;
    }
    return 'Unknown customer';
  }

  factory BillingCustomer.fromJson(Map<String, dynamic> json) {
    double parseDouble(Object? v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }

    return BillingCustomer(
      id: json['id'].toString(),
      email: (json['email'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      totalSpent: parseDouble(json['total_spent']),
      subscriptionStatus: (json['subscription_status'] as String?) ?? '',
      subscriptionAmount: parseDouble(json['subscription_amount']),
      createdAt: json['created_at'] as String?,
    );
  }
}

/// One row from /api/owner/billing/transactions.
class BillingTransaction {
  final String id;
  final String type; // payment | refund
  final double amount;
  final String currency;
  final String status;
  final String customerEmail;
  final String customerName;
  final String description;
  final String? createdAt;

  const BillingTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    required this.status,
    required this.customerEmail,
    required this.customerName,
    required this.description,
    required this.createdAt,
  });

  bool get isRefund => type.toLowerCase() == 'refund';

  factory BillingTransaction.fromJson(Map<String, dynamic> json) {
    double parseDouble(Object? v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }

    return BillingTransaction(
      id: json['id'].toString(),
      type: (json['type'] as String?) ?? 'payment',
      amount: parseDouble(json['amount']),
      currency: (json['currency'] as String?) ?? 'usd',
      status: (json['status'] as String?) ?? '',
      customerEmail: (json['customer_email'] as String?) ?? '',
      customerName: (json['customer_name'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      createdAt: json['created_at'] as String?,
    );
  }
}
