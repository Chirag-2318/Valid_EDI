import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const bodyClassName = 'bg-background font-body text-on-surface min-h-screen flex items-center justify-center p-4 md:p-8 page-login';

export function LoginPage() {
  const navigate = useNavigate();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    navigate('/dashboard_sleek');
  };

  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 18%, rgba(14, 165, 233, 0.22) 0%, rgba(14, 165, 233, 0) 45%),' +
              'radial-gradient(circle at 85% 72%, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 50%),' +
              'linear-gradient(135deg, #cfefff 0%, #e9f6fb 45%, #f8fbff 100%)'
          }}
        />
        <div
          className="absolute -top-20 -left-24 h-[360px] w-[360px] rounded-full blur-3xl opacity-80"
          style={{ background: 'radial-gradient(circle, rgba(45, 212, 191, 0.35) 0%, rgba(45, 212, 191, 0) 70%)' }}
        />
        <div
          className="absolute bottom-[-140px] right-[-120px] h-[420px] w-[420px] rounded-full blur-[110px] opacity-75"
          style={{ background: 'radial-gradient(circle, rgba(14, 116, 144, 0.35) 0%, rgba(14, 116, 144, 0) 70%)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-white/60 via-transparent to-white/30" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'linear-gradient(120deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 60%)',
            mixBlendMode: 'soft-light'
          }}
        />
      </div>

      <main className="relative z-10 w-full max-w-[1200px] aspect-auto md:aspect-[16/9] flex items-center justify-center">
        <div className="glass-panel w-full max-w-[480px] p-10 md:p-12 rounded-[2rem] shadow-2xl shadow-primary/5 border border-white/40 flex flex-col items-center">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_balance_wallet
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-primary mb-1">EdiPro</h1>
            <p className="text-secondary font-medium text-sm tracking-wide">HEALTHCARE EDI GATEWAY</p>
          </div>

          <form className="w-full space-y-6" noValidate onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-[0.7rem] font-bold text-outline uppercase tracking-widest ml-1">Professional Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl">mail</span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-highest/30 border border-outline-variant/20 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none placeholder:text-outline/50"
                  placeholder="name@organization.com"
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[0.7rem] font-bold text-outline uppercase tracking-widest">Password</label>
                <a className="text-[0.7rem] font-bold text-primary hover:text-primary-container transition-colors uppercase tracking-widest" href="#">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl">lock</span>
                <input
                  className="w-full pl-12 pr-12 py-4 bg-surface-container-highest/30 border border-outline-variant/20 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none placeholder:text-outline/50"
                  placeholder="************"
                  type={isPasswordVisible ? 'text' : 'password'}
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={isPasswordVisible}
                  onClick={() => setIsPasswordVisible((previous) => !previous)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl">
                    {isPasswordVisible ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-4">
              <button
                className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-xl shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                type="submit"
              >
                Sign In
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/30"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-transparent px-4 text-outline font-medium uppercase tracking-widest">or</span>
                </div>
              </div>
              <button
                className="w-full py-4 bg-white/50 border border-outline-variant/30 text-on-surface font-semibold rounded-xl hover:bg-white/80 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                type="button"
              >
                <img
                  alt="SSO Provider"
                  className="w-5 h-5"
                  data-alt="Google logo icon for single sign on authentication"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBl_5pOtcmjDWT3t-yYF8M0XDRe233mAuSzmukYiU3WLDcD54ndVSeRtFWl7sGhYK-iBXDFItyZLiyupCu8DnfUucQrHB4nvANoFtXcol5Phf7CrFftUnzbYuywGj2T-vqS3vIKUm13WziATxsuOtCIz4hIWyDR940cxN83JeNArlhHDWqAd5dbPYutPUd4Yd5Gw9fzF5TFyHH71bNogT2V45551DhHGPLgncTlwyE1LWIpfiUPFokQb2OaL-EbMT14DubHgBs8XQWY"
                />
                Sign in with SSO
              </button>
            </div>
          </form>

          <footer className="mt-12 w-full flex flex-col items-center gap-4">
            <p className="text-sm text-secondary font-medium">
              New to the portal?{' '}
              <a className="text-primary font-bold hover:underline" href="#">
                Request access
              </a>
            </p>
            <div className="flex gap-6 text-[0.65rem] font-bold text-outline uppercase tracking-widest">
              <a className="hover:text-primary transition-colors" href="#">
                HIPAA Compliance
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Security Policy
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Support
              </a>
            </div>
          </footer>
        </div>

      </main>

      <div className="fixed bottom-8 right-8 z-20 pointer-events-none">
        <p className="text-[0.6rem] font-black text-primary/30 uppercase tracking-[0.3em] vertical-text transform rotate-90 origin-right">
          System Version 4.2.0-Alpha
        </p>
      </div>
    </>
  );
}

