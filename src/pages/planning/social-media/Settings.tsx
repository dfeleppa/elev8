import React, { useState } from 'react';
import { Facebook, Instagram, Globe2 } from 'lucide-react';
import { initiateOAuth } from '../../../utils/oauth';

interface SocialAccount {
  id: string;
  platform: 'google' | 'instagram' | 'facebook';
  connected: boolean;
  name?: string;
}

const Settings: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([
    {
      id: '1',
      platform: 'google',
      connected: false
    },
    {
      id: '2',
      platform: 'instagram',
      connected: false
    },
    {
      id: '3',
      platform: 'facebook',
      connected: false
    }
  ]);

  const handleConnect = async (platform: 'google' | 'instagram' | 'facebook') => {
    try {
      await initiateOAuth(platform);
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      // Handle error appropriately
    }
  };

  const handleDisconnect = (platform: 'google' | 'instagram' | 'facebook') => {
    setAccounts(prev => prev.map(account => 
      account.platform === platform 
        ? { ...account, connected: false, name: undefined }
        : account
    ));
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google':
        return <Globe2 size={24} />;
      case 'instagram':
        return <Instagram size={24} />;
      case 'facebook':
        return <Facebook size={24} />;
      default:
        return null;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'google':
        return 'Google Business Profile';
      case 'instagram':
        return 'Instagram';
      case 'facebook':
        return 'Facebook';
      default:
        return platform;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Connected Accounts</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect your social media accounts to manage them from one place
          </p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {accounts.map((account) => (
            <div key={account.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  account.connected 
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {getPlatformIcon(account.platform)}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {getPlatformName(account.platform)}
                  </h3>
                  {account.connected && account.name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Connected as {account.name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => account.connected 
                  ? handleDisconnect(account.platform)
                  : handleConnect(account.platform)
                }
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  account.connected
                    ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    : 'text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                } transition-colors duration-200`}
              >
                {account.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Account Permissions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review and manage the permissions granted to each connected account
          </p>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>When you connect an account, you grant us permission to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Read your profile information</li>
              <li>Post content on your behalf</li>
              <li>View your account statistics</li>
              <li>Manage your posts and schedule content</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;