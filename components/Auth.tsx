
import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../services/firebase';
import { SendIcon } from './Icon';

interface AuthProps {
    onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            onAuthSuccess();
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/user-not-found') setError('Usuário não encontrado.');
            else if (err.code === 'auth/wrong-password') setError('Senha incorreta.');
            else if (err.code === 'auth/invalid-email') setError('E-mail inválido.');
            else if (err.code === 'auth/email-already-in-use') setError('Este e-mail já está em uso.');
            else if (err.code === 'auth/weak-password') setError('A senha deve ter pelo menos 6 caracteres.');
            else if (err.code === 'auth/configuration-not-found') setError('Configuração não encontrada. Newton, você REALMENTE ativou a "Identity Toolkit API" no Google Cloud Library para este projeto?');
            else setError(`Erro ao autenticar (${err.code}). Verifique sua conexão e se o login por e-mail está ativo no Firebase.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6 font-nunito">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 p-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                        <span className="text-white font-black text-2xl tracking-tighter">B</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                        {isLogin ? 'Bem-vindo ao SagB' : 'Criar Nova Conta'}
                    </h1>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">
                        {isLogin ? 'Painel de Gestão Estratégica' : 'Cadastre-se para acessar o ecossistema'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">E-mail Corporativo</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-medium"
                            placeholder="seu@grupob.com.br"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">Senha de Acesso</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-medium"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-500 text-[11px] font-bold px-4 py-3 rounded-xl border border-red-100 animate-shake">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-black text-white font-black py-4 rounded-2xl shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>{isLogin ? 'Entrar no Sistema' : 'Finalizar Cadastro'}</span>
                                <SendIcon className="w-4 h-4 rotate-[-45deg]" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center px-4">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-[11px] font-black text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
                    >
                        {isLogin ? 'Não tem conta? Cadastrar-se' : 'Já tem conta? Entrar agora'}
                    </button>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-50 flex justify-center gap-6">
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">GrupoB 2026</span>
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">•</span>
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">v2.0</span>
                </div>
            </div>
        </div>
    );
};

export default Auth;
