import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { testConnection, testConnectionWithRetry, ConnectionTestResult } from '../api/api';

interface ConnectionStatusProps {
  showDetails?: boolean;
  autoTest?: boolean;
  testInterval?: number; // in milliseconds
  onStatusChange?: (status: ConnectionTestResult) => void;
}

type ConnectionState = 'testing' | 'connected' | 'disconnected' | 'error';

const ConnectionStatus = ({
  showDetails = false,
  autoTest = true,
  testInterval = 30000, // 30 seconds
  onStatusChange
}: ConnectionStatusProps) => {
  const [connectionState, setConnectionState] = useState('testing' as ConnectionState);
  const [lastResult, setLastResult] = useState(null as ConnectionTestResult | null);
  const [lastTestTime, setLastTestTime] = useState(null as Date | null);

  const performConnectionTest = async (withRetry: boolean = false) => {
    setConnectionState('testing');
    
    try {
      const result = withRetry 
        ? await testConnectionWithRetry(3)
        : await testConnection();
      
      setLastResult(result);
      setLastTestTime(new Date());
      setConnectionState(result.success ? 'connected' : 'disconnected');
      
      if (onStatusChange) {
        onStatusChange(result);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      const errorResult: ConnectionTestResult = {
        success: false,
        responseTime: 0,
        error: 'Test failed to execute'
      };
      setLastResult(errorResult);
      setLastTestTime(new Date());
      setConnectionState('error');
      
      if (onStatusChange) {
        onStatusChange(errorResult);
      }
    }
  };

  // Initial test and periodic testing
  useEffect(() => {
    if (autoTest) {
      performConnectionTest(true); // Initial test with retry
      
      const interval = setInterval(() => {
        performConnectionTest(false); // Periodic tests without retry
      }, testInterval);
      
      return () => clearInterval(interval);
    }
  }, [autoTest, testInterval]);

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'testing':
        return <Loader size={16} className="animate-spin text-blue-500" />;
      case 'connected':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'disconnected':
        return <WifiOff size={16} className="text-red-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-orange-500" />;
      default:
        return <Wifi size={16} className="text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'testing':
        return 'Testing connection...';
      case 'connected':
        return `Connected (${lastResult?.responseTime}ms)`;
      case 'disconnected':
        return 'Connection failed';
      case 'error':
        return 'Test error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'testing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'error':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="text-sm font-medium">{getStatusText()}</span>
      
      {showDetails && lastResult && (
        <div className="ml-2 text-xs">
          <button
            onClick={() => performConnectionTest(true)}
            className="underline hover:no-underline"
            disabled={connectionState === 'testing'}
          >
            Retry
          </button>
        </div>
      )}
      
      {showDetails && lastResult && !lastResult.success && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-64">
          <div className="text-sm">
            <div className="font-medium text-red-600 mb-2">Connection Details:</div>
            <div className="space-y-1 text-gray-600">
              <div>URL: {lastResult.details?.url}</div>
              {lastResult.details?.status && (
                <div>Status: {lastResult.details.status} {lastResult.details.statusText}</div>
              )}
              <div>Error: {lastResult.error}</div>
              <div>Response Time: {lastResult.responseTime}ms</div>
              {lastTestTime && (
                <div>Last Test: {lastTestTime.toLocaleTimeString()}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;