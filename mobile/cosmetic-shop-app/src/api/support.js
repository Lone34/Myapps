// src/api/support.js
import client from './client';

/**
 * Get all support tickets for the logged-in user.
 * Backend: GET /api/support/tickets/
 */
export async function fetchMyTickets() {
  const res = await client.get('support/tickets/');
  return res.data;
}

/**
 * Get full detail for one ticket (including messages).
 * Backend: GET /api/support/tickets/:id/
 */
export async function fetchTicketDetail(ticketId) {
  const res = await client.get(`support/tickets/${ticketId}/`);
  return res.data;
}

/**
 * Create a new support ticket.
 * Backend: POST /api/support/tickets/create/
 * body: { subject, category, message, order_number? }
 */
export async function createSupportTicket({
  subject,
  category,
  message,
  orderNumber,
}) {
  const payload = {
    subject,
    category, // "order" | "return" | "refund" | "technical" | "other"
    message,
  };

  if (orderNumber && orderNumber.trim()) {
    payload.order_number = orderNumber.trim();
  }

  const res = await client.post('support/tickets/create/', payload);
  return res.data;
}

/**
 * Reply to an existing ticket.
 * Backend: POST /api/support/tickets/:id/reply/
 * body: { message }
 */
export async function replyToTicket(ticketId, message) {
  const res = await client.post(`support/tickets/${ticketId}/reply/`, {
    message,
  });
  return res.data;
}
