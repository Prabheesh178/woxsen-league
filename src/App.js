import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, CreditCard, CheckCircle, Moon, Sun, Activity, Trash2, 
  Lock, MapPin, User, LogOut, Filter, QrCode, X, ChevronDown, 
  History, Clock, AlertTriangle, Power, Unlock 
} from 'lucide-react';
import { db } from './firebase'; 
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

const FACILITIES = [
  { id: 1, name: "Cricket Arena", type: "Outdoor", moonlightPrice: 500, image: "/images/cricket.jpeg", fallback: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800", courts: ["Main Pitch", "Net 1", "Net 2"], slots: ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"] },
  { id: 2, name: "Football Turf", type: "Outdoor", moonlightPrice: 800, image: "/images/football.jpg", fallback: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800", courts: ["Side A", "Side B"], slots: ["19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"] },
  { id: 3, name: "Badminton Arena", type: "Indoor", moonlightPrice: 300, image: "/images/badminton.jpeg", fallback: "https://images.unsplash.com/photo-1626224583764-847890e058f5?w=800", courts: ["Court 1", "Court 2", "Court 3", "Court 4", "Court 5", "Court 6", "Court 7", "Court 8"], slots: ["06:00", "07:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"] },
  { id: 4, name: "Tennis Courts", type: "Outdoor", moonlightPrice: 400, image: "/images/tennis.jpeg", fallback: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800", courts: ["Court 1", "Court 2"], slots: ["06:00", "18:00", "19:00", "20:00"] },
  { id: 5, name: "Volleyball", type: "Outdoor", moonlightPrice: 300, image: "/images/volleyball.jpeg", fallback: "https://images.unsplash.com/photo-1612872087720-48ca45e4c6c9?w=800", courts: ["Sand Court"], slots: ["17:00", "18:00", "19:00"] },
  { id: 6, name: "Squash", type: "Indoor", moonlightPrice: 200, image: "/images/squash.jpeg", fallback: "https://plus.unsplash.com/premium_photo-1664303847960-586318f59035?w=800", courts: ["Court 1"], slots: ["18:00", "19:00"] },
  { id: 7, name: "Pickleball", type: "Outdoor", moonlightPrice: 250, image: "/images/pickleball.jpeg", fallback: "https://plus.unsplash.com/premium_photo-1683888726880-928929729a6e?w=800", courts: ["Court A"], slots: ["17:00", "18:00"] },
  { id: 8, name: "Pool & Foosball", type: "Indoor", moonlightPrice: 100, image: "/images/pool.jpeg", fallback: "https://images.unsplash.com/photo-1554593685-a764722ebc2d?w=800", courts: ["Table 1", "Table 2"], slots: ["12:00", "13:00", "14:00", "18:00", "19:00", "20:00"] },
];

export default function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [myBookings, setMyBookings] = useState([]);
  const [lastBookingId, setLastBookingId] = useState(null);
  const [filter, setFilter] = useState('All');
  const [ticketModal, setTicketModal] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // SYSTEM STATES
  const [systemSettings, setSystemSettings] = useState({ globalLockdown: false, disabledFacilities: [] });
  const [scanResult, setScanResult] = useState(null);
  const [manualId, setManualId] = useState("");

  const menuRef = useRef(null);
  const bookingsCollection = collection(db, "bookings");

  useEffect(() => {
    // 1. Listen for Bookings
    const unsubscribe = onSnapshot(bookingsCollection, (snapshot) => {
      const liveData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setMyBookings(liveData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });

    // 2. Listen for System Settings
    const settingsRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      } else {
        setSystemSettings({ globalLockdown: false, disabledFacilities: [] });
      }
    });

    const savedUser = localStorage.getItem('woxsen_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      setView(u.role === 'warden' ? 'warden' : 'home');
    }
    
    const handleClickOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => { unsubscribe(); unsubscribeSettings(); document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  // --- ADMIN & VERIFY ---
  const toggleGlobalLock = async () => {
    const newState = !systemSettings.globalLockdown;
    if(window.confirm(newState ? "🔴 EMERGENCY: STOP ALL BOOKINGS?" : "🟢 RESUME Bookings?")) {
      await setDoc(doc(db, "system", "settings"), { ...systemSettings, globalLockdown: newState });
    }
  };

  const toggleFacility = async (facilityName) => {
    let current = systemSettings.disabledFacilities || [];
    let newDisabledList = current.includes(facilityName) ? current.filter(name => name !== facilityName) : [...current, facilityName];
    await setDoc(doc(db, "system", "settings"), { ...systemSettings, disabledFacilities: newDisabledList });
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (manualId.toLowerCase() === "bypass") {
      setScanResult({ status: 'valid', data: { student: "VIP Guest (Demo)", facility: "Any Facility", time: "NOW", id: "ADMIN-OVERRIDE" } });
      setManualId(""); return;
    }
    const bookingToVerify = myBookings.find(b => b.id === manualId);
    setScanResult(bookingToVerify ? { status: 'valid', data: bookingToVerify } : { status: 'invalid' });
    setManualId("");
  };

  // --- CORE FUNCTIONS ---
  const handleLogin = (email) => {
    let role = 'student';
    if (email.toLowerCase().includes('warden') || email.includes('admin')) role = 'warden';
    else if (!email.includes('@woxsen.edu.in')) { alert("Access Denied. Use Woxsen Email."); return; }
    const newUser = { email, name: email.split('@')[0], role };
    setUser(newUser);
    localStorage.setItem('woxsen_user', JSON.stringify(newUser));
    setView(role === 'warden' ? 'warden' : 'home');
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('woxsen_user'); setView('login'); setIsMenuOpen(false); };
  
  const saveBooking = async (booking) => {
    try {
      const docRef = await addDoc(bookingsCollection, booking);
      setTicketModal({ ...booking, id: docRef.id }); 
      setView('home'); 
    } catch (err) { alert("Database Error: " + err.message); }
  };

  const deleteBooking = async (id) => {
    if(window.confirm("Cancel this booking?")) {
      try { await deleteDoc(doc(db, "bookings", id)); } catch (err) { alert("Error: " + err.message); }
    }
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    const hour = parseInt(slot.split(':')[0]);
    if (hour >= 0 && hour < 6) { setCurrentPrice(selectedFacility.moonlightPrice); } else { setCurrentPrice(0); }
  };

  const handlePayment = () => {
    const isPaid = currentPrice > 0;
    if (window.confirm(isPaid ? `Pay ₹${currentPrice} via Razorpay?` : "Confirm Free Booking?")) {
      const newBooking = { facility: selectedFacility.name, court: selectedCourt || selectedFacility.courts[0], time: selectedSlot, date: new Date().toLocaleDateString(), price: currentPrice, status: isPaid ? "Paid (UPI)" : "Free Slot", student: user.email, timestamp: new Date() };
      saveBooking(newBooking); 
    }
  };

  const Navbar = () => (
    <nav className={`${user?.role === 'warden' ? 'bg-gray-900' : 'bg-red-600'} text-white p-4 shadow-lg sticky top-0 z-50 flex justify-between items-center`}>
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => user && setView(user.role === 'warden' ? 'warden' : 'home')}>
        <Activity className="h-6 w-6" />
        <span className="font-bold text-xl tracking-tight hidden md:block">{user?.role === 'warden' ? 'WARDEN DASHBOARD' : 'WOXSEN LEAGUE'}</span>
        <span className="font-bold text-xl tracking-tight md:hidden">WL</span>
      </div>
      {user && (
        <div className="relative" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center space-x-2 bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded-full transition-all">
            <div className="w-6 h-6 bg-white text-red-600 rounded-full flex items-center justify-center text-xs font-bold">{user.name.charAt(0).toUpperCase()}</div>
            <span className="text-sm font-medium hidden sm:block max-w-[80px] truncate">{user.name}</span>
            <ChevronDown size={14} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl py-2 border border-gray-100 animate-fade-in z-50">
              <div className="px-4 py-2 border-b border-gray-100 mb-1"><p className="text-xs text-gray-400 uppercase font-bold">Signed in as</p><p className="text-sm text-gray-800 font-medium truncate">{user.email}</p></div>
              {user.role === 'student' && (<button onClick={() => { setView('mybookings'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center transition-colors"><History size={16} className="mr-2" /> My Bookings</button>)}
              {user.role === 'warden' && (<button onClick={() => { setView('warden'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center transition-colors"><Lock size={16} className="mr-2" /> Admin Panel</button>)}
              <div className="border-t border-gray-100 mt-1 pt-1"><button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"><LogOut size={16} className="mr-2" /> Logout</button></div>
            </div>
          )}
        </div>
      )}
    </nav>
  );

  const TicketModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative animate-fade-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <div className="text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Activity className="h-8 w-8 text-red-600" /></div><h2 className="text-2xl font-bold text-gray-900">Entry Ticket</h2><p className="text-sm text-gray-500 mb-6">Show this to the Warden</p><div className="bg-gray-900 p-6 rounded-xl inline-block mb-4 shadow-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${booking.id}`} alt="QR" className="w-40 h-40 rounded-lg mix-blend-screen" /><p className="text-white font-mono text-sm mt-2 tracking-widest truncate max-w-[200px] mx-auto">{booking.id}</p></div><div className="text-left space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="flex justify-between"><span className="text-gray-500 text-sm">Facility</span><span className="font-bold text-gray-900 text-sm">{booking.facility}</span></div><div className="flex justify-between"><span className="text-gray-500 text-sm">Court</span><span className="font-bold text-gray-900 text-sm">{booking.court}</span></div><div className="flex justify-between"><span className="text-gray-500 text-sm">Time</span><span className="font-bold text-gray-900 text-sm">{booking.time}</span></div><div className="flex justify-between"><span className="text-gray-500 text-sm">Status</span><span className={`font-bold text-sm ${booking.price > 0 ? 'text-green-600' : 'text-blue-600'}`}>{booking.status}</span></div></div></div>
      </div>
    </div>
  );

  if (view === 'login') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-red-600">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><Activity className="h-10 w-10 text-red-600" /></div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">The League</h1>
        <p className="text-gray-500 mb-8">Woxsen University Sports Portal</p>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(e.target.email.value); }}>
          <input name="email" type="email" placeholder="id@woxsen.edu.in" className="w-full p-4 border border-gray-300 rounded-xl mb-4 focus:ring-2 focus:ring-red-600 outline-none" required />
          <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors shadow-lg">Login</button>
        </form>
        <div className="mt-6 text-xs text-gray-400 bg-gray-50 p-3 rounded border"><p><strong>Demo Accounts:</strong></p><p>Student: <code>any@woxsen.edu.in</code></p><p>Warden: <code>warden@woxsen.edu.in</code></p></div>
      </div>
    </div>
  );

  // --- WARDEN VIEW (ADMIN) ---
  if (view === 'warden') return (
    <div className="min-h-screen font-sans text-gray-900 pb-10 bg-gray-100">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        
        {/* TICKET VERIFIER */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-indigo-600 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0"><h3 className="text-2xl font-bold text-gray-800 flex items-center"><QrCode className="mr-2" /> Verify Ticket</h3><p className="text-gray-500">Scan QR Code or enter Booking ID.</p></div>
          <form onSubmit={handleVerify} className="flex w-full md:w-auto"><input type="text" placeholder="ID or Scan..." value={manualId} onChange={(e) => setManualId(e.target.value)} className="border-2 border-gray-300 rounded-l-xl px-4 py-3 w-64 focus:border-indigo-600 focus:outline-none font-mono text-sm" autoFocus /><button type="submit" className="bg-indigo-600 text-white px-6 rounded-r-xl font-bold hover:bg-indigo-700">CHECK</button></form>
        </div>

        {scanResult && ( <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]" onClick={() => setScanResult(null)}><div className={`bg-white p-8 rounded-2xl max-w-sm w-full text-center border-t-8 animate-fade-in ${scanResult.status === 'valid' ? 'border-green-500' : 'border-red-500'}`} onClick={e => e.stopPropagation()}>{scanResult.status === 'valid' ? (<><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-10 w-10 text-green-600" /></div><h2 className="text-3xl font-bold text-green-600 mb-2">ACCESS GRANTED</h2><div className="bg-gray-100 rounded-xl p-4 mt-4 text-left"><p className="text-sm text-gray-500">Student</p><p className="font-bold text-lg mb-2">{scanResult.data.student.split('@')[0]}</p><p className="text-sm text-gray-500">Facility</p><p className="font-bold text-lg mb-2">{scanResult.data.facility}</p><p className="text-sm text-gray-500">Time</p><p className="font-bold text-lg">{scanResult.data.time}</p></div></>) : (<><div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><X className="h-10 w-10 text-red-600" /></div><h2 className="text-3xl font-bold text-red-600 mb-2">INVALID TICKET</h2><p className="text-gray-500">ID not found.</p></>)}<button onClick={() => setScanResult(null)} className="mt-8 w-full py-3 rounded-xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300">Close</button></div></div> )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500"><h3 className="text-gray-500 text-sm font-bold uppercase">Total Bookings</h3><p className="text-3xl font-bold mt-2">{myBookings.length}</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500"><h3 className="text-gray-500 text-sm font-bold uppercase">Active Students</h3><p className="text-3xl font-bold mt-2">{new Set(myBookings.map(b => b.student)).size}</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500"><h3 className="text-gray-500 text-sm font-bold uppercase">Moonlight Revenue</h3><p className="text-3xl font-bold mt-2">₹{myBookings.reduce((acc, curr) => acc + (curr.price || 0), 0)}</p></div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center"><Power className="mr-2 text-gray-500"/> Maintenance Controls</h3>
          <div className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all mb-6 ${systemSettings.globalLockdown ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
            <div><h4 className={`font-bold text-lg ${systemSettings.globalLockdown ? 'text-red-700' : 'text-green-700'}`}>{systemSettings.globalLockdown ? 'SYSTEM LOCKED DOWN' : 'SYSTEM OPERATIONAL'}</h4><p className="text-sm text-gray-600">{systemSettings.globalLockdown ? 'No students can book any slots.' : 'Bookings are open.'}</p></div>
            <button onClick={toggleGlobalLock} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${systemSettings.globalLockdown ? 'bg-red-600' : 'bg-green-600'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${systemSettings.globalLockdown ? 'translate-x-7' : 'translate-x-1'}`} /></button>
          </div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Individual Facilities</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">{FACILITIES.map(f => { const isLocked = systemSettings.disabledFacilities?.includes(f.name); return ( <div key={f.id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50"><span className="font-medium text-sm text-gray-700">{f.name}</span><button onClick={() => toggleFacility(f.name)} className={`p-2 rounded-lg transition-colors ${isLocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600 hover:bg-gray-200'}`}>{isLocked ? <Lock size={16} /> : <Unlock size={16} />}</button></div> ) })}</div>
        </div>

        {/* LIVE FEED - FILTERED FOR REAL-TIME */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Live Booking Feed</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-4">Student</th><th className="p-4">Facility</th><th className="p-4">Time</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {myBookings
                  // --- NEW FILTER LOGIC ---
                  .filter(b => {
                    const isToday = b.date === new Date().toLocaleDateString();
                    if (!isToday) return false; // Hide old days
                    const currentHour = new Date().getHours();
                    const bookingHour = parseInt(b.time.split(':')[0]);
                    // Show future slots AND slots currently happening (e.g. if now is 14:30, show 14:00)
                    // Also handles midnight (00-05) slots if viewed late at night
                    if (bookingHour < 6 && currentHour > 18) return true; 
                    return bookingHour >= currentHour;
                  })
                  // ------------------------
                  .map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{b.student.split('@')[0]}</td>
                      <td className="p-4">{b.facility}<br/><span className="text-xs text-gray-500">{b.court}</span></td>
                      <td className="p-4">{b.time}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${b.price > 0 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{b.status}</span></td>
                      <td className="p-4"><button onClick={() => deleteBooking(b.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );

  // --- STUDENT VIEW ---
  return (
    <div className="min-h-screen font-sans text-gray-900 pb-10 bg-gray-50">
      <Navbar />
      {ticketModal && <TicketModal booking={ticketModal} onClose={() => setTicketModal(null)} />}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {view === 'home' && (
          <>
            {systemSettings.globalLockdown && ( <div className="bg-red-50 border-l-4 border-red-600 p-6 mb-8 rounded-r-xl animate-pulse"><div className="flex items-center"><AlertTriangle className="text-red-600 h-8 w-8 mr-4" /><div><h3 className="text-xl font-bold text-red-700">System Maintenance</h3><p className="text-red-600">Booking is temporarily suspended.</p></div></div></div> )}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 pt-4"><div><h1 className="text-3xl font-extrabold text-gray-900">Welcome, {user.name}</h1><p className="text-gray-500 text-sm mt-1">Book your slot at SportX.</p></div><div className="flex space-x-2 mt-4 md:mt-0 overflow-x-auto pb-2 w-full md:w-auto">{['All', 'Indoor', 'Outdoor'].map(t => <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === t ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border'}`}>{t}</button>)}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{FACILITIES.filter(f => filter === 'All' || f.type === filter).map(f => { const isLocked = systemSettings.globalLockdown || systemSettings.disabledFacilities?.includes(f.name); return ( <div key={f.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden transition-all duration-300 ${isLocked ? 'opacity-75 grayscale' : 'hover:shadow-xl cursor-pointer group transform hover:-translate-y-1'}`} onClick={() => { if (!isLocked) { setSelectedFacility(f); setSelectedCourt(f.courts[0]); setView('booking'); } else { alert("Facility Closed"); } }}>{isLocked && ( <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/10 backdrop-blur-[1px]"><div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-lg"><Lock size={12} className="mr-1"/> CLOSED</div></div> )}<div className="h-48 relative overflow-hidden rounded-t-2xl"><img src={f.image} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" alt={f.name} onError={(e) => e.target.src = f.fallback} /><div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm flex items-center"><MapPin size={10} className="mr-1"/> {f.type}</div></div><div className="p-5"><h3 className="font-bold text-lg mb-1 truncate">{f.name}</h3><div className="flex justify-between text-xs text-gray-500 mt-3 font-medium"><span className="flex items-center bg-green-50 text-green-700 px-2 py-1 rounded"><Sun size={12} className="mr-1"/> Free</span><span className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded"><Moon size={12} className="mr-1"/> ₹{f.moonlightPrice}</span></div></div></div> ); })}</div>
          </>
        )}

        {view === 'booking' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 animate-fade-in max-w-2xl mx-auto">
            <button onClick={() => { setView('home'); setSelectedSlot(null); }} className="text-gray-400 hover:text-gray-900 mb-6 text-sm font-medium flex items-center">← Back to Facilities</button><h2 className="text-3xl font-bold mb-2">{selectedFacility.name}</h2>
            {(() => {
              const hasBookingToday = myBookings.some(b => b.student === user.email && b.facility === selectedFacility.name && b.date === new Date().toLocaleDateString());
              return (
                <>
                  {hasBookingToday && ( <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg"><p className="font-bold text-orange-700 text-sm">Daily Limit Reached</p><p className="text-orange-600 text-xs">You have already booked 1 hour for {selectedFacility.name} today.</p></div> )}
                  <div className="mb-8"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Court / Table</label><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{selectedFacility.courts.map(court => (<button key={court} onClick={() => { setSelectedCourt(court); setSelectedSlot(null); }} className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${selectedCourt === court ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{court}</button>))}</div></div>
                  <div className="mb-8"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Time (Today)</label><div className="grid grid-cols-3 md:grid-cols-4 gap-3">{selectedFacility.slots.map((slot) => { const hour = parseInt(slot.split(':')[0]); const isMoonlight = hour >= 0 && hour < 6; const isTaken = myBookings.some(b => b.facility === selectedFacility.name && b.court === selectedCourt && b.time === slot && b.date === new Date().toLocaleDateString()); const isDisabled = isTaken || hasBookingToday; return ( <button key={slot} disabled={isDisabled} onClick={() => handleSlotSelect(slot)} className={`py-3 px-2 rounded-xl text-sm font-medium transition-all relative flex flex-col items-center justify-center border-2 ${isDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60' : selectedSlot === slot ? 'border-red-600 bg-red-50 text-red-600' : 'border-transparent bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><div className="flex items-center space-x-1 mb-1">{isMoonlight ? <Moon size={12} /> : <Sun size={12} />}<span className={isTaken ? 'line-through' : ''}>{slot}</span></div><span className={`text-[10px] uppercase font-bold ${isDisabled ? 'text-gray-400' : isMoonlight ? 'text-indigo-500' : 'text-green-500'}`}>{isTaken ? 'BOOKED' : hasBookingToday ? 'LIMIT' : isMoonlight ? `₹${selectedFacility.moonlightPrice}` : 'FREE'}</span></button> ); })}</div></div>
                  <div className="border-t border-gray-100 pt-6"><div className="flex justify-between items-center mb-6"><div><p className="text-xs text-gray-400 uppercase font-bold">Total Payable</p><p className="text-3xl font-black text-gray-900">₹{currentPrice}</p></div>{currentPrice > 0 && <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">Moonlight Fee</span>}</div><button disabled={!selectedSlot} onClick={handlePayment} className="w-full py-4 rounded-xl font-bold text-lg bg-red-600 text-white shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{currentPrice > 0 ? `Pay ₹${currentPrice}` : 'Confirm Booking'}</button></div>
                </>
              );
            })()}
          </div>
        )}

        {view === 'success' && ( <div className="bg-white rounded-2xl shadow-xl p-8 text-center mt-10 max-w-md mx-auto border-t-8 border-red-600"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div><h2 className="text-2xl font-bold text-gray-900 mb-1">Booking Confirmed!</h2><p className="text-gray-500 mb-6 text-sm">Scan this QR at the gate.</p><div className="bg-gray-900 p-4 rounded-xl inline-block mb-6"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${lastBookingId}`} alt="QR" className="w-32 h-32 rounded-lg mix-blend-screen" /></div><button onClick={() => { setView('home'); setSelectedSlot(null); }} className="text-red-600 font-bold hover:underline">Book Another</button></div> )}
        
        {view === 'mybookings' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center mb-6"><button onClick={() => setView('home')} className="mr-4 text-gray-400 hover:text-gray-900">←</button><h2 className="text-2xl font-bold">My Bookings</h2></div>
            <div className="space-y-4 mb-8">{myBookings.filter(b => b.student === user.email).map(b => (<div key={b.id} className="bg-white p-5 rounded-xl shadow-sm border border-green-100 flex justify-between items-center"><div className="flex items-center space-x-3"><div className="h-10 w-1 bg-green-500 rounded-full"></div><div><h3 className="font-bold text-gray-900">{b.facility}</h3><p className="text-sm text-gray-600">{b.court} • {b.time}</p></div></div><button onClick={() => setTicketModal(b)} className="text-white bg-black px-4 py-2 rounded-lg text-xs font-bold flex items-center"><QrCode size={14} className="mr-2"/> Ticket</button></div>))}</div>
          </div>
        )}
      </main>
    </div>
  );
}