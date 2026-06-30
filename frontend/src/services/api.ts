import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  getMe: () => api.get('/auth/me'),
}

export const reposApi = {
  list: () => api.get('/repos'),
  getRuns: (owner: string, repo: string, status = 'failure') =>
    api.get(`/repos/${owner}/${repo}/runs`, { params: { status } }),
}

export const pipelineApi = {
  analyze: (data: {
    repo_full_name: string
    run_id: number
    workflow_name: string
    branch: string
    commit_sha: string
    commit_message: string
  }) => api.post('/pipeline/analyze', data),
  getRuns: () => api.get('/pipeline/runs'),
  getStats: () => api.get('/pipeline/stats'),
  getRunDetail: (id: number) => api.get(`/pipeline/runs/${id}`),
}

export default api
