import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { isFirebaseConfigured } from '../firebase/config';

type FormMode = 'login' | 'signup' | 'forgotPassword';

const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<FormMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, sendPasswordResetEmail, loginWithGoogle } = useUser();

  useEffect(() => {
    if (!isFirebaseConfigured) {
        setError('Configuração do Firebase incompleta. Por favor, edite o arquivo firebase/config.ts com suas credenciais.');
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
        setError('Configuração do Firebase incompleta. Por favor, edite o arquivo firebase/config.ts com suas credenciais.');
        return;
    }
    if (!email.trim() || (mode !== 'forgotPassword' && !password.trim()) || (mode === 'signup' && !name.trim())) {
        setError('Todos os campos obrigatórios devem ser preenchidos.');
        return;
    }
    setLoading(true);
    setError('');
    setFeedbackMessage('');
    try {
        if (mode === 'login') {
            await login(email, password);
        } else if (mode === 'signup') {
            await signup(email, password, name);
        } else {
            await sendPasswordResetEmail(email);
            setFeedbackMessage('Link de recuperação enviado! Verifique seu e-mail (incluindo a caixa de spam).');
        }
    } catch (err: any) {
        if (mode === 'forgotPassword') {
            // To prevent user enumeration, show a generic success message even on error.
            setFeedbackMessage('Se este e-mail estiver cadastrado, um link de recuperação será enviado.');
        } else if (err.code) {
            switch (err.code) {
                case 'auth/invalid-email':
                    setError('O formato do e-mail é inválido.');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                     setError('E-mail ou senha incorretos.');
                    break;
                case 'auth/email-already-in-use':
                    setError('Este e-mail já está em uso. Tente fazer login.');
                    break;
                case 'auth/weak-password':
                    setError('A senha deve ter no mínimo 6 caracteres.');
                    break;
                case 'auth/invalid-api-key':
                    setError('Chave de API do Firebase inválida. Verifique o arquivo firebase/config.ts');
                    break;
                case 'auth/network-request-failed':
                    setError('Erro de rede. Verifique sua conexão com a internet.');
                    break;
                default:
                    setError('Ocorreu um erro. Tente novamente.');
            }
        } else {
            setError('Ocorreu um erro desconhecido.');
        }
    } finally {
        setLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured) {
      setError('Configuração do Firebase incompleta. Por favor, edite o arquivo firebase/config.ts com suas credenciais.');
      return;
    }
    setLoading(true);
    setError('');
    setFeedbackMessage('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Ocorreu um erro ao tentar fazer login com o Google.');
        console.error("Google Sign-In Error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: FormMode) => {
      setMode(newMode);
      setError('');
      setFeedbackMessage('');
      setEmail('');
      setPassword('');
      setName('');
      if (!isFirebaseConfigured) {
        setError('Configuração do Firebase incompleta. Por favor, edite o arquivo firebase/config.ts com suas credenciais.');
      }
  }

  const getTitle = () => {
    switch(mode) {
        case 'login': return 'Bem-vindo de Volta';
        case 'signup': return 'Crie sua Conta';
        case 'forgotPassword': return 'Recuperar Senha';
    }
  }

   const getSubtitle = () => {
    switch(mode) {
        case 'login': return 'Acesse sua conta para continuar.';
        case 'signup': return 'Preencha os dados para começar.';
        case 'forgotPassword': return 'Digite seu e-mail para receber o link de recuperação.';
    }
  }
  
  const getButtonText = () => {
     if (loading) return <i className="fa-solid fa-spinner fa-spin"></i>;
     switch(mode) {
        case 'login': return 'Entrar';
        case 'signup': return 'Cadastrar';
        case 'forgotPassword': return 'Enviar Link';
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
            <div className="inline-block w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                <i className="fa-solid fa-wallet text-3xl text-white"></i>
            </div>
          <h1 className="text-3xl font-bold text-white">{getTitle()}</h1>
          <p className="text-gray-400">{getSubtitle()}</p>
        </div>
        
        {/* Email Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="sr-only">Nome</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Seu nome"
                />
              </div>
          )}
          <div>
            <label htmlFor="email" className="sr-only">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="seu@email.com"
            />
          </div>
          {mode !== 'forgotPassword' && (
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === 'login' ? "Senha" : "Crie uma senha (mín. 6 caracteres)"}
              />
            </div>
          )}
          
          {mode === 'login' && (
             <div className="text-right text-sm">
                <button type="button" onClick={() => switchMode('forgotPassword')} className="font-medium text-blue-400 hover:text-blue-300 hover:underline">
                    Esqueceu a senha?
                </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {feedbackMessage && <p className="text-green-400 text-sm text-center">{feedbackMessage}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {getButtonText()}
          </button>
        </form>

        {/* Divider and Social Login */}
        {mode === 'login' && (
            <>
                <div className="relative flex items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-4 text-xs text-gray-400">OU</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-3 px-4 py-2 font-semibold text-gray-800 bg-white rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.591,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    </svg>
                    <span>Entrar com Google</span>
                </button>
            </>
        )}
        
        {/* Mode Switcher */}
        <div className="text-center">
            {mode === 'login' && 
                <button onClick={() => switchMode('signup')} className="text-sm text-blue-400 hover:underline">
                    Não tem uma conta? Cadastre-se
                </button>
            }
             {mode === 'signup' && 
                <button onClick={() => switchMode('login')} className="text-sm text-blue-400 hover:underline">
                    Já tem uma conta? Faça login
                </button>
            }
             {mode === 'forgotPassword' && 
                <button onClick={() => switchMode('login')} className="text-sm text-blue-400 hover:underline">
                    Voltar para o Login
                </button>
            }
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;