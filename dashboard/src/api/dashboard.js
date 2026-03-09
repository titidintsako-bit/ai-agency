import client from './client'

export const getStats = () =>
  client.get('/dashboard/stats')

export const getAgents = () =>
  client.get('/dashboard/agents')

export const getConversations = (params = {}) =>
  client.get('/dashboard/conversations', { params })

export const getEscalations = (params = {}) =>
  client.get('/dashboard/escalations', { params })

export const updateEscalation = (id, data) =>
  client.patch(`/dashboard/escalations/${id}`, data)

export const getConversationMessages = (id) =>
  client.get(`/dashboard/conversations/${id}/messages`)

export const getAppointments = (params = {}) =>
  client.get('/dashboard/appointments', { params })
