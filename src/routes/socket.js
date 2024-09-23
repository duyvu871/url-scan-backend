

module.exports = {
    /**
     * @param {import('socket.io').Server} io
     */
    loadDirBuster: (io) => {
        const namespace = io.of('/dirbuster').on('connection', (socket) => {
            console.log('Dirbuster connected');
            socket.on('disconnect', () => {
                console.log('Dirbuster disconnected');
            });
        });
    },
}