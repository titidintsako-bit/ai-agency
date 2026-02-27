import client from './client'

export const getUsage      = (period = 'daily') => client.get('/analytics/usage',      { params: { period } })
export const getCosts      = (period = 'daily') => client.get('/analytics/costs',      { params: { period } })
export const getResolution = ()                 => client.get('/analytics/resolution')
export const getQuestions  = ()                 => client.get('/analytics/questions')
