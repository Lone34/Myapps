// app/support.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons'; // Ensure you have this installed

// --- Custom Components (Matches HomeScreen) ---
import AppHeader from '../src/components/AppHeader';
import AnimatedBackground from '../src/components/AnimatedBackground';
import { useNavBar } from '../src/context/NavBarContext';

import {
  fetchMyTickets,
  fetchTicketDetail,
  createSupportTicket,
  replyToTicket,
} from '../src/api/support';

const SUPPORT_PHONE = '+91-XXXXXXXXXX'; 
const SUPPORT_EMAIL = 'kupwaracart@gmail.com'; 

// From your website embed:
const TAWK_PROPERTY_ID = '69046273c231fe1951c83091';
const TAWK_WIDGET_ID = 'default';
const TAWK_CHAT_URL = `https://tawk.to/chat/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  waiting_support: 'Waiting for Support',
  waiting_user: 'Waiting for You',
  closed: 'Closed',
};

const CATEGORY_LABELS: Record<string, string> = {
  order: 'Order',
  return: 'Return',
  refund: 'Refund',
  technical: 'Technical',
  other: 'Other',
};

const SupportScreen: React.FC = () => {
  const router = useRouter();
  const { handleScroll } = useNavBar(); // Hook for hiding/showing bottom nav

  // --- Tawk chat state ---
  const [chatVisible, setChatVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);

  // --- Ticket list state ---
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  // --- Ticket detail / chat modal ---
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
  const [ticketDetailError, setTicketDetailError] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null); // To scroll to bottom of chat

  // --- New ticket modal ---
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<string>('order');
  const [newOrderNumber, setNewOrderNumber] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicketError, setNewTicketError] = useState<string | null>(null);

  // ---------------- Handlers ----------------

  const handleCall = () => {
    const clean = SUPPORT_PHONE.replace(/[^+0-9]/g, '');
    if (!clean) return;
    Linking.openURL(`tel:${clean}`).catch(() => {});
  };

  const handleEmail = () => {
    if (!SUPPORT_EMAIL) return;
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

  const openChat = () => {
    setChatError(null);
    setChatLoading(true);
    setChatVisible(true);
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    setAuthRequired(false);

    try {
      const data = await fetchMyTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setAuthRequired(true);
        setTickets([]);
      } else {
        setTicketsError('Unable to load tickets.');
      }
    } finally {
      setTicketsLoading(false);
    }
  };

  const openTicketModal = async (ticket: any) => {
    setTicketModalVisible(true);
    setActiveTicket(null);
    setTicketDetailError(null);
    setTicketDetailLoading(true);

    try {
      const detail = await fetchTicketDetail(ticket.id);
      setActiveTicket(detail);
      // Scroll to bottom after load
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 500);
    } catch (err: any) {
      setTicketDetailError('Unable to load ticket details.');
    } finally {
      setTicketDetailLoading(false);
    }
  };

  const handleSendReply = async () => {
    const text = ticketReply.trim();
    if (!activeTicket || !text || sendingReply) return;

    setSendingReply(true);
    try {
      const msg = await replyToTicket(activeTicket.id, text);
      setActiveTicket((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), msg],
          status: prev.status === 'closed' ? prev.status : 'waiting_support',
        };
      });
      setTicketReply('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      loadTickets(); // Refresh background list
    } catch (err: any) {
      setTicketDetailError('Unable to send message.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      setNewTicketError('Subject and message are required.');
      return;
    }
    setCreatingTicket(true);
    try {
      const created = await createSupportTicket({
        subject: newSubject,
        category: newCategory,
        message: newMessage,
        orderNumber: newOrderNumber || undefined,
      });
      setNewTicketVisible(false);
      setNewSubject('');
      setNewCategory('order');
      setNewOrderNumber('');
      setNewMessage('');
      loadTickets();
      openTicketModal(created);
    } catch (err: any) {
      setNewTicketError('Failed to create ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  // ---------------- Effects ----------------
  useEffect(() => {
    loadTickets();
  }, []);

  // Poll active ticket
  useEffect(() => {
    if (!ticketModalVisible || !activeTicket?.id) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await fetchTicketDetail(activeTicket.id);
        setActiveTicket((prev: any) => (prev?.id === activeTicket.id ? fresh : prev));
      } catch (err) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [ticketModalVisible, activeTicket?.id]);


  // ---------------- Render Helpers ----------------
  const renderStatusPill = (status: string) => {
    const label = STATUS_LABELS[status] || status;
    let bg = '#333';
    let color = '#ccc';
    if (status === 'open') { bg = '#064e3b'; color = '#6ee7b7'; } // Dark Green
    else if (status === 'waiting_support') { bg = '#1e3a8a'; color = '#93c5fd'; } // Dark Blue
    else if (status === 'waiting_user') { bg = '#713f12'; color = '#fde047'; } // Dark Yellow
    
    return (
      <View style={[styles.statusPill, { backgroundColor: bg }]}>
        <Text style={[styles.statusPillText, { color }]}>{label}</Text>
      </View>
    );
  };

  // ---------------- Main Render ----------------
  return (
    <SafeAreaView style={styles.screen}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* 1. Use AppHeader for consistency */}
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll} // 2. Connect to NavBarContext
        scrollEventThrottle={16}
      >
        <Text style={styles.sectionTitle}>Help & Support</Text>

        {/* --- TICKETS CARD --- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>My Tickets</Text>
            <TouchableOpacity onPress={loadTickets} disabled={ticketsLoading}>
               <Ionicons name="refresh" size={18} color="#D4AF37" />
            </TouchableOpacity>
          </View>

          {authRequired ? (
            <View style={styles.centerBox}>
              <Text style={styles.infoText}>Login to manage tickets.</Text>
              <TouchableOpacity style={styles.goldBtn} onPress={() => router.push('/login')}>
                <Text style={styles.goldBtnText}>Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {ticketsError && <Text style={styles.errorText}>{ticketsError}</Text>}
              
              {!ticketsLoading && tickets.length === 0 && (
                 <Text style={styles.emptyText}>No tickets yet.</Text>
              )}

              {tickets.map((t) => (
                <TouchableOpacity key={t.id} style={styles.ticketRow} onPress={() => openTicketModal(t)}>
                  <View style={styles.ticketRowTop}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                    {renderStatusPill(t.status)}
                  </View>
                  <Text style={styles.ticketSub}>
                    {CATEGORY_LABELS[t.category] || 'General'} • {new Date(t.updated_at).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.goldOutlineBtn} onPress={() => setNewTicketVisible(true)}>
                <Text style={styles.goldOutlineBtnText}>+ Create New Ticket</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* --- CONTACT & CHAT --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Contact</Text>
          
          <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
             <View style={styles.iconCircle}><Ionicons name="call" size={18} color="#000" /></View>
             <View>
               <Text style={styles.contactLabel}>Call Support</Text>
               <Text style={styles.contactValue}>{SUPPORT_PHONE}</Text>
             </View>
          </TouchableOpacity>
          
          <View style={styles.divider} />

          <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
             <View style={styles.iconCircle}><Ionicons name="mail" size={18} color="#000" /></View>
             <View>
               <Text style={styles.contactLabel}>Email Support</Text>
               <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
             </View>
          </TouchableOpacity>

           <View style={styles.divider} />

          <TouchableOpacity style={styles.contactRow} onPress={openChat}>
             <View style={[styles.iconCircle, {backgroundColor: '#22c55e'}]}><Ionicons name="chatbubbles" size={18} color="#fff" /></View>
             <View>
               <Text style={styles.contactLabel}>Live Chat</Text>
               <Text style={styles.contactValue}>Talk to an agent now</Text>
             </View>
          </TouchableOpacity>
        </View>

        <View style={{height: 100}} /> 
      </ScrollView>

      {/* --- CHAT MODAL (Fixes Applied Here) --- */}
      <Modal visible={ticketModalVisible} animationType="slide" onRequestClose={() => setTicketModalVisible(false)}>
        {/* SafeAreaView handles top notch */}
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
             <TouchableOpacity onPress={() => setTicketModalVisible(false)}>
                <Ionicons name="chevron-down" size={28} color="#D4AF37" />
             </TouchableOpacity>
             <View style={{alignItems: 'center'}}>
                <Text style={styles.modalHeaderTitle}>Ticket #{activeTicket?.id}</Text>
                <Text style={styles.modalHeaderSub}>{activeTicket?.subject}</Text>
             </View>
             <View style={{width: 28}} />
          </View>
          
          {/* KeyboardAvoidingView pushes content up when keyboard opens */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            {ticketDetailLoading ? (
              <View style={styles.centerFill}><ActivityIndicator color="#D4AF37" /></View>
            ) : (
              <View style={{flex: 1}}>
                <ScrollView 
                  ref={scrollViewRef}
                  style={styles.chatScroll} 
                  contentContainerStyle={styles.chatContent}
                >
                  {activeTicket?.messages?.map((m: any, i: number) => {
                    const isMe = m.sender_role === 'user';
                    return (
                      <View key={i} style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                         <View style={[styles.bubble, isMe ? styles.bubbleBgMe : styles.bubbleBgOther]}>
                            <Text style={styles.bubbleText}>{m.message}</Text>
                            <Text style={styles.bubbleTime}>
                               {isMe ? 'You' : 'Support'} • {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </Text>
                         </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* REPLY BOX: Added paddingBottom for Safe Area on devices without physical buttons */}
                <View style={styles.replyBar}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#666"
                    value={ticketReply}
                    onChangeText={setTicketReply}
                    multiline
                  />
                  <TouchableOpacity 
                    style={[styles.sendBtn, !ticketReply.trim() && {opacity: 0.5}]} 
                    onPress={handleSendReply}
                    disabled={!ticketReply.trim() || sendingReply}
                  >
                    {sendingReply ? <ActivityIndicator color="#000" size="small" /> : <Ionicons name="send" size={20} color="#000" />}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- NEW TICKET MODAL --- */}
      <Modal visible={newTicketVisible} animationType="fade" transparent onRequestClose={() => setNewTicketVisible(false)}>
         <View style={styles.overlay}>
            <View style={styles.popup}>
               <Text style={styles.popupTitle}>Create Ticket</Text>
               
               <Text style={styles.label}>Subject</Text>
               <TextInput style={styles.input} placeholderTextColor="#555" placeholder="e.g., Refund for Order #123" value={newSubject} onChangeText={setNewSubject} />
               
               <Text style={styles.label}>Category</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10, maxHeight: 40}}>
                  {Object.keys(CATEGORY_LABELS).map((cat) => (
                    <TouchableOpacity key={cat} onPress={() => setNewCategory(cat)} style={[styles.catChip, newCategory === cat && styles.catChipActive]}>
                       <Text style={[styles.catText, newCategory === cat && styles.catTextActive]}>{CATEGORY_LABELS[cat]}</Text>
                    </TouchableOpacity>
                  ))}
               </ScrollView>

               <Text style={styles.label}>Message</Text>
               <TextInput 
                  style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                  multiline 
                  placeholderTextColor="#555" 
                  placeholder="Describe your issue..." 
                  value={newMessage} 
                  onChangeText={setNewMessage} 
                />

                <View style={styles.popupActions}>
                   <TouchableOpacity style={styles.cancelBtn} onPress={() => setNewTicketVisible(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.goldBtn} onPress={handleCreateTicket} disabled={creatingTicket}>
                      <Text style={styles.goldBtnText}>{creatingTicket ? "Sending..." : "Submit"}</Text>
                   </TouchableOpacity>
                </View>
            </View>
         </View>
      </Modal>

      {/* --- TAWK WEBVIEW MODAL --- */}
      <Modal visible={chatVisible} animationType="slide" onRequestClose={() => setChatVisible(false)}>
         <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
            <View style={{flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#eee'}}>
               <TouchableOpacity onPress={() => setChatVisible(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
               <Text style={{fontSize: 18, fontWeight: 'bold', marginLeft: 10}}>Live Chat</Text>
            </View>
            <WebView source={{ uri: TAWK_CHAT_URL }} style={{flex: 1}} />
         </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

export default SupportScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#001A33' },
  scrollContent: { paddingBottom: 30 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: '#D4AF37', marginHorizontal: 16, marginVertical: 16 },
  
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  
  // List Styles
  ticketRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  ticketRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketSubject: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
  ticketSub: { color: '#aaa', fontSize: 12 },
  emptyText: { color: '#888', fontStyle: 'italic', marginVertical: 10 },
  errorText: { color: '#ff6b6b', marginVertical: 10 },

  // Buttons
  goldBtn: { backgroundColor: '#D4AF37', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  goldBtnText: { color: '#000', fontWeight: 'bold' },
  goldOutlineBtn: { borderWidth: 1, borderColor: '#D4AF37', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  goldOutlineBtnText: { color: '#D4AF37', fontWeight: '600' },

  // Contact
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D4AF37', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactLabel: { color: '#aaa', fontSize: 12 },
  contactValue: { color: '#fff', fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },

  // Status Pills
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusPillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Chat Modal
  modalSafe: { flex: 1, backgroundColor: '#001A33' },
  modalHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalHeaderTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalHeaderSub: { color: '#aaa', fontSize: 12 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  chatScroll: { flex: 1 },
  chatContent: { padding: 16 },
  bubbleWrap: { marginVertical: 4, width: '100%' },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 12 },
  bubbleBgMe: { backgroundColor: '#D4AF37', borderBottomRightRadius: 2 },
  bubbleBgOther: { backgroundColor: '#333', borderBottomLeftRadius: 2 },
  bubbleText: { color: '#fff', fontSize: 15 },
  bubbleTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  // THE FIX: Reply Bar
  replyBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 10, 
    borderTopWidth: 1, 
    borderColor: '#333',
    // Important: Add padding bottom for phones with gesture bars if needed, 
    // though SafeAreaView usually handles it. Adding a small buffer helps.
    paddingBottom: Platform.OS === 'ios' ? 0 : 20 
  },
  replyInput: { 
    flex: 1, 
    backgroundColor: '#222', 
    color: '#fff', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    maxHeight: 100,
    marginRight: 10
  },
  sendBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#D4AF37', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Popup
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  popup: { backgroundColor: '#111', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#333' },
  popupTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  label: { color: '#aaa', marginBottom: 6, fontSize: 12, marginTop: 10 },
  input: { backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#444' },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#555', marginRight: 8 },
  catChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  catText: { color: '#aaa' },
  catTextActive: { color: '#000', fontWeight: 'bold' },
  popupActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 10 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#888' },
  centerBox: { alignItems: 'center', padding: 20 },
  infoText: { color: '#aaa', marginBottom: 10 },
});
