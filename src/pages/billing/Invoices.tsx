import React, { useState } from 'react';
import { ExternalLink, MoreVertical, Download, Send, Eye } from 'lucide-react';

interface Invoice {
  id: string;
  created: string;
  description: string;
  status: 'paid' | 'pending' | 'failed';
  customer: {
    name: string;
    email: string;
  };
  dueDate: string;
  amount: number;
}

const Invoices: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  // Mock data - replace with actual API call
  const invoices: Invoice[] = [
    {
      id: 'inv_123',
      created: '2024-03-15',
      description: 'Monthly Membership - March 2024',
      status: 'paid',
      customer: {
        name: 'John Smith',
        email: 'john@example.com'
      },
      dueDate: '2024-03-15',
      amount: 99.99
    },
    {
      id: 'inv_124',
      created: '2024-03-14',
      description: 'Personal Training Session',
      status: 'pending',
      customer: {
        name: 'Sarah Wilson',
        email: 'sarah@example.com'
      },
      dueDate: '2024-03-28',
      amount: 75.00
    },
    {
      id: 'inv_125',
      created: '2024-03-13',
      description: 'Gym Merchandise',
      status: 'failed',
      customer: {
        name: 'Mike Johnson',
        email: 'mike@example.com'
      },
      dueDate: '2024-03-13',
      amount: 45.50
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and view your invoices</p>
        </div>
        <a
          href="https://dashboard.stripe.com/invoices"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          <ExternalLink size={16} className="mr-2" />
          Open Stripe Dashboard
        </a>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description/Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(invoice.created)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{invoice.description}</div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{invoice.customer.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{invoice.customer.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(invoice.dueDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() => setSelectedInvoice(selectedInvoice === invoice.id ? null : invoice.id)}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {selectedInvoice === invoice.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1" role="menu">
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              <Eye size={16} className="mr-2" />
                              View Details
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              <Download size={16} className="mr-2" />
                              Download PDF
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              <Send size={16} className="mr-2" />
                              Send to Customer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Invoices;