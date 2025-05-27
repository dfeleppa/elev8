import React, { useState } from 'react';
import { Eye, EyeOff, CreditCard, DollarSign, Settings } from 'lucide-react';

const BillingSetup: React.FC = () => {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [stripeConfig, setStripeConfig] = useState({
    accountName: 'Elevate Fitness',
    accountId: 'acct_1234567890',
    currency: 'USD',
    publishableKey: 'pk_test_...',
    secretKey: 'sk_test_...',
    paymentMethods: ['card']
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing Setup</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure your Stripe integration</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CreditCard className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            <h2 className="ml-2 text-lg font-medium text-gray-900 dark:text-white">Stripe Configuration</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Stripe Account Name
              </label>
              <input
                type="text"
                value={stripeConfig.accountName}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Stripe Account ID
              </label>
              <input
                type="text"
                value={stripeConfig.accountId}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Currency
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={stripeConfig.currency}
                  readOnly
                  className="block w-full pl-10 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Publishable Key
              </label>
              <input
                type="text"
                value={stripeConfig.publishableKey}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Secret Key
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={stripeConfig.secretKey}
                  readOnly
                  className="block w-full pr-10 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center"
                >
                  {showSecretKey ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Method Preferences
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={stripeConfig.paymentMethods.includes('card')}
                    readOnly
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Card Payments
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="h-5 w-5 text-gray-400" />
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Need to update these settings?
              </span>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Configure Stripe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSetup;