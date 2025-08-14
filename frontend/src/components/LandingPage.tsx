import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  
  const selectRole = (role: string) => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex justify-center items-center p-5">
      {/* Phone Frame */}
      <div className="w-[375px] h-[812px] bg-gray-700 rounded-[40px] p-1 shadow-2xl relative">
        {/* Screen */}
        <div className="w-full h-full bg-white rounded-[36px] overflow-hidden relative">
          {/* Status Bar */}
          <div className="h-11 bg-white flex justify-between items-center px-5 text-sm font-medium text-gray-900 border-b border-gray-100 font-mono">
            <span>09:41</span>
            <span>••• ••• ••• ⚡95%</span>
          </div>
          
          {/* Main Content */}
          <div className="h-[calc(100%-44px)] bg-gradient-to-br from-blue-600 to-green-600 text-white relative overflow-y-auto">
            
            {/* Security Badge */}
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-3 py-1 text-xs font-bold font-mono z-10">
              🔒 SECURE PLATFORM
            </div>

            {/* Hero Section */}
            <div className="text-center pt-6 px-6">
              <h1 className="text-4xl font-extrabold mb-2">HelpQo</h1>
              <p className="text-xs opacity-90 font-medium tracking-widest uppercase font-mono mb-4">
                Verified • Insured • Trusted
              </p>
              
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-3">Secure Marketplace for Help & Work</h2>
                <p className="text-sm opacity-90">Connect safely with government-verified professionals</p>
              </div>

              {/* Value Cards */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">🏠</div>
                  <div className="text-sm font-bold">Find Help</div>
                  <div className="text-xs opacity-85">Verified pros ready</div>
                </div>
                <div className="flex-1 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">💰</div>
                  <div className="text-sm font-bold">Earn Income</div>
                  <div className="text-xs opacity-85">Join trusted network</div>
                </div>
              </div>

              {/* Trust Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-6 px-2">
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-xs opacity-80 uppercase tracking-wide font-mono mb-1">Response</div>
                  <div className="text-lg font-bold font-mono">2min</div>
                  <div className="text-xs opacity-80 uppercase tracking-wide font-mono">Success</div>
                  <div className="text-lg font-bold font-mono">98.7%</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-xs opacity-80 uppercase tracking-wide font-mono mb-1">Avg Weekly</div>
                  <div className="text-lg font-bold font-mono">₱2,450</div>
                  <div className="text-xs opacity-80 uppercase tracking-wide font-mono">Active Pros</div>
                  <div className="text-lg font-bold font-mono">8,247</div>
                </div>
              </div>

              {/* Security Grid */}
              <div className="grid grid-cols-3 gap-2 mb-6 px-2">
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">🏛️</div>
                  <div className="text-xs font-bold uppercase">DTI REG</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">🔒</div>
                  <div className="text-xs font-bold uppercase">SSL ENC</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">🛡️</div>
                  <div className="text-xs font-bold uppercase">₱1M INS</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">✅</div>
                  <div className="text-xs font-bold uppercase">NBI CLR</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">💳</div>
                  <div className="text-xs font-bold uppercase">BSP COMP</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">⭐</div>
                  <div className="text-xs font-bold uppercase">4.9 RATE</div>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="px-5 pb-6">
              <h3 className="text-center text-lg font-bold mb-4 opacity-95">Choose your path to success</h3>
              
              <div className="space-y-4">
                {/* Client Card */}
                <div 
                  onClick={() => selectRole('client')}
                  className="bg-white/95 text-gray-900 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border border-white/50 relative"
                >
                  <div className="absolute top-3 right-3 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">SECURE</div>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center text-white text-2xl">
                      🏠
                    </div>
                    <div>
                      <div className="text-lg font-bold">Get Help Fast</div>
                      <div className="text-sm text-gray-600">Book verified professionals</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    Access verified, NBI-cleared professionals. Secure payments, instant booking, guaranteed results.
                  </p>
                  
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border">
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">✓ Verified</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">⏱️ 2min Response</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">🔒 Secure Pay</div>
                    </div>
                  </div>
                </div>

                {/* Worker Card */}
                <div 
                  onClick={() => selectRole('worker')}
                  className="bg-white/95 text-gray-900 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border border-white/50 relative"
                >
                  <div className="absolute top-3 right-3 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">VERIFIED</div>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center text-white text-2xl">
                      💼
                    </div>
                    <div>
                      <div className="text-lg font-bold">Earn Income</div>
                      <div className="text-sm text-gray-600">Join verified professionals</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    Join 8,247 verified pros earning ₱2,450/week. Guaranteed payments, flexible schedule, premium support.
                  </p>
                  
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border">
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">💰 ₱2,450/wk</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">🏛️ NBI Cleared</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-green-600">🏆 Pro Status</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;