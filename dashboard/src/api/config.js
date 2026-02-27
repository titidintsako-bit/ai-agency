import client from './client'

export const listClients  = ()                      => client.get('/config')
export const getConfig    = (slug)                  => client.get(`/config/${slug}`)
export const updateConfig = (slug, config)          => client.put(`/config/${slug}`, { config })
