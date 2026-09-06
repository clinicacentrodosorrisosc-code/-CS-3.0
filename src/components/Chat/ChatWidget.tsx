import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ChatMessage } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

export const ChatWidget: React.FC<{ currentUserId: string; currentUserName: string }> = ({ currentUserId, currentUserName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        await addDoc(collection(db, 'chat_messages'), {
            content: newMessage,
            senderId: currentUserId,
            senderName: currentUserName,
            timestamp: new Date().toISOString()
        });
        setNewMessage('');
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100]">
            <AnimatePresence>
                {isOpen ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-80 h-[28rem] glass-panel rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 border-white/20">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-black/20 dark:bg-black/60 backdrop-blur-2xl">
                            <h3 className="font-bold text-text text-sm uppercase tracking-wider">Chat Interno</h3>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 glass-button rounded-lg text-slate-400 hover:text-text transition-all"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.map(m => (
                                <div key={m.id} className={`flex flex-col ${m.senderId === currentUserId ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] text-slate-500 mb-0.5 font-bold uppercase tracking-tight">{m.senderName}</span>
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] shadow-sm ${m.senderId === currentUserId ? 'glass-button bg-indigo-500/20 text-text rounded-tr-none' : 'glass-button bg-panel text-slate-200 rounded-tl-none'}`}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 border-t border-border bg-black/20 dark:bg-black/60 backdrop-blur-2xl flex gap-2">
                            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-panel border border-border rounded-xl px-4 py-2.5 text-text outline-none focus:border-indigo-500/50 transition-colors text-sm" placeholder="Sua mensagem..." />
                            <button onClick={handleSend} className="glass-button bg-indigo-500/30 p-2.5 rounded-xl text-text hover:text-indigo-300 transition-all shadow-lg active:scale-90"><Send className="w-5 h-5" /></button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button 
                        whileHover={{ scale: 1.1, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)} 
                        className="w-16 h-16 rounded-full glass-button flex items-center justify-center text-text shadow-2xl group transition-all duration-500"
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <MessageSquare className="w-7 h-7 relative z-10 drop-shadow-lg" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};
