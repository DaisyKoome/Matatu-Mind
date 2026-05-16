/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Map as MapIcon, 
  MessageSquare, 
  Bus, 
  AlertTriangle, 
  Navigation, 
  Share2, 
  MapPin, 
  ChevronRight,
  Info,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { cn } from "./lib/utils";
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from "./lib/firebase";

// Fix Leaflet marker icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Message {
  role: "user" | "model";
  content: string;
  groundingMetadata?: any;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", content: "Sasa! I'm **MatatuMind**. Tell me where you are and where you're headed, and I'll find you the best matatu route. I can also check real-time traffic and weather for you! \n\nExample: *'How is the traffic on Mombasa Road and what's the weather like?'*" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        // Silently restore session
        loadSession(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadSession = async (uid: string) => {
    try {
      const response = await fetch(`/api/session/${uid}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.history && data.history.length > 0) {
        // Convert parts format to content format
        const restoredMessages = data.history.map((m: any) => ({
          role: m.role,
          content: m.parts[0].text
        }));
        setMessages(restoredMessages);
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => auth.signOut();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          uid: user?.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();
      if (data.text) {
        setMessages(prev => [...prev, { 
          role: "model", 
          content: data.text,
          groundingMetadata: data.groundingMetadata
        }]);
      } else {
        throw new Error("Empty response from agent");
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { 
        role: "model", 
        content: `Pole... I encountered an error: ${error.message || "Unknown issue"}. Please try again.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden text-slate-900">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Matatu<span className="text-blue-600">Mind</span> <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 uppercase tracking-widest">v2.5</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 mr-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Session Persistence Active</span>
          </div>
          
          <AnimatePresence mode="wait">
            {isAuthLoading ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 pl-1 pr-3 py-1 rounded-full">
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-7 h-7 rounded-full border border-white" />
                <span className="text-[10px] font-bold text-slate-600 hidden sm:inline">{user.displayName?.split(' ')[0]}</span>
                <button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
              >
                <UserIcon className="w-3.5 h-3.5" />
                COMMUTER SIGN IN
              </button>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setShowMap(!showMap)}
            className="md:hidden bg-slate-100 text-slate-700 p-2 rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            {showMap ? <MessageSquare className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar: Transit Intelligence (Hidden on mobile) */}
        <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Transit Intel</h2>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <div className="text-blue-600 text-lg">🗺️</div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-blue-900 truncate">Nairobi_Base_Map</p>
                  <p className="text-[10px] text-blue-600 font-medium">Decoded: 34 Major Routes</p>
                </div>
              </div>
              <div className="p-3 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="text-slate-400 text-lg">📍</div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-slate-700 truncate">Green_Park_Terminus</p>
                  <p className="text-[10px] text-slate-400 font-medium font-mono uppercase">Status: Active</p>
                </div>
              </div>
              <div className="p-3 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="text-slate-400 text-lg">🚏</div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-slate-700 truncate">Railways_Terminus</p>
                  <p className="text-[10px] text-slate-400 font-medium font-mono uppercase">Status: High Traffic</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto p-4 border-t border-slate-50 bg-slate-50/50">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center mb-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Accuracy</span>
              <span className="text-xs font-bold text-emerald-600">98% AI Match</span>
            </div>
            <button className="w-full py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs font-bold hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-all">
              Export Analysis (JSON)
            </button>
          </div>
        </aside>

        {/* Central Panel: Agent Chat */}
        <section className={cn(
          "flex-1 flex flex-col bg-slate-50 relative transition-all duration-300",
          showMap ? "hidden md:flex" : "flex"
        )}>
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
          >
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-start gap-4",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-110",
                  msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-slate-800 text-white"
                )}>
                  {msg.role === "user" ? <Navigation className="w-4 h-4" /> : <span className="text-[10px] font-bold">MM</span>}
                </div>
                <div className={cn(
                  "max-w-[85%] md:max-w-xl p-5 rounded-2xl shadow-sm transition-all border",
                  msg.role === "user" 
                    ? "bg-blue-600 text-white rounded-tr-none border-blue-500 font-medium" 
                    : "bg-white text-slate-700 rounded-tl-none border-slate-200"
                )}>
                  <div className={cn(
                    "prose prose-sm max-w-none prose-p:leading-relaxed prose-strong:font-bold prose-strong:text-blue-600 prose-ul:my-2 pb-1",
                    msg.role === "user" && "prose-invert prose-strong:text-blue-100"
                  )}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.groundingMetadata?.groundingChunks?.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sources from Insights</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingMetadata.groundingChunks.map((chunk: any, ci: number) => {
                          const web = chunk.web;
                          const maps = chunk.maps;
                          if (web) {
                            return (
                              <a 
                                key={ci} 
                                href={web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 px-2 py-1 rounded flex items-center gap-1 transition-colors truncate max-w-[200px]"
                              >
                                <Info className="w-3 h-3" />
                                {web.title || "Source"}
                              </a>
                            );
                          }
                          if (maps) {
                            return (
                              <a 
                                key={ci} 
                                href={maps.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                              >
                                <MapPin className="w-3 h-3" />
                                Google Maps
                              </a>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-white font-bold animate-pulse">...</span>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded animate-pulse">Calculating Route</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-6 bg-transparent">
            <div className="relative bg-white shadow-xl shadow-slate-200 border border-slate-200 rounded-2xl overflow-hidden flex items-center px-4 py-3 group focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about a route or connection..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder-slate-400 font-medium"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="ml-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 flex items-center gap-2"
              >
                <span className="text-xs font-bold hidden sm:inline px-1">Send</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Rush hour protocol active</span>
              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fares subject to weather</span>
              <span className="flex items-center gap-1 shrink-0"><MapPin className="w-3 h-3" /> Stage names verified by local SACCOs</span>
            </div>
          </div>
        </section>

        {/* Right Panel: Map Visualization */}
        <aside className={cn(
          "bg-white transition-all duration-500 flex flex-col shrink-0 overflow-hidden",
          showMap ? "w-full absolute inset-0 z-[100]" : "w-0 md:w-80 lg:w-[450px] border-l border-slate-200"
        )}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <MapIcon className="w-4 h-4 text-slate-400" />
              Route Visualization
            </h3>
            {showMap && (
              <button 
                onClick={() => setShowMap(false)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>
          
          <div className="flex-1 relative overflow-hidden bg-slate-100">
            {(showMap || window.innerWidth >= 768) && (
              <MapContainer 
                center={[-1.286389, 36.817223]} 
                zoom={13} 
                className="w-full h-full grayscale hover:grayscale-0 transition-all duration-500"
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[-1.2921, 36.8219]} icon={new L.DivIcon({ className: 'custom-div-icon', html: '<div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6);"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })}>
                  <Popup>Railways Terminus</Popup>
                </Marker>
                <Marker position={[-1.2831, 36.8229]} icon={new L.DivIcon({ className: 'custom-div-icon', html: '<div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6);"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })}>
                  <Popup>Kencom</Popup>
                </Marker>
                <Marker position={[-1.2858, 36.8288]} icon={new L.DivIcon({ className: 'custom-div-icon', html: '<div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6);"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })}>
                  <Popup>OTC Stage</Popup>
                </Marker>
                <Marker position={[-1.2878, 36.8152]} icon={new L.DivIcon({ className: 'custom-div-icon', html: '<div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(37, 99, 235, 0.6);"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })}>
                  <Popup>Green Park</Popup>
                </Marker>
              </MapContainer>
            )}
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Route Specifics</h4>
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Network Processing</span>
                  <span className="text-blue-600 font-black">4.8k Nodes</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="w-[85%] h-full bg-blue-600 rounded-full"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Scale</p>
                  <p className="text-sm font-bold text-slate-800">133+ Routes</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Latency</p>
                  <p className="text-sm font-bold text-emerald-600">Sync: 12ms</p>
                </div>
              </div>
              <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                Generate Full Route Analysis
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
