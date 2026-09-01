import React from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface BannedScreenProps {
  reason?: string;
  appealUrl?: string;
}

const BannedScreen: React.FC<BannedScreenProps> = ({
  reason = 'Your account has been suspended',
  appealUrl = '#',
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-red-50">
      <div className="text-center max-w-md">
        <AlertTriangle className="mx-auto mb-4 text-red-600" size={64} />
        <h1 className="text-3xl font-bold text-red-600 mb-4">Account Suspended</h1>
        <p className="text-gray-700 mb-4">{reason}</p>
        <p className="text-gray-600 text-sm mb-8">
          If you believe this is a mistake, you can appeal the decision.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-semibold"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          <a
            href={appealUrl}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Appeal
          </a>
        </div>
      </div>
    </div>
  );
};

export default BannedScreen;