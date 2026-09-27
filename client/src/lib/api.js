// Re-export from canonical api/axios.js
export {
    api,
    api as
    default,
    setAccessToken,
    getAccessToken,
    setRefreshToken,
    getRefreshToken,
    SOCKET_URL,
}
from '../api/axios.js';
export { serverStatus }
from '../api/serverStatus.js';