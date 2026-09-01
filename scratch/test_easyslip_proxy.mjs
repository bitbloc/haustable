import handler from '../api/verify-slip.js'

async function run() {
    console.log('Testing EasySlip info proxy...')
    const req = {
        method: 'POST',
        body: { action: 'info' }
    }
    const res = {
        setHeader: () => {},
        status: (code) => ({
            json: (data) => {
                console.log('STATUS:', code)
                console.log('RESULT:', JSON.stringify(data, null, 2))
                process.exit(0)
            },
            end: () => {
                console.log('END:', code)
                process.exit(0)
            }
        })
    }
    await handler(req, res)
}

run().catch(err => {
    console.error('ERROR:', err)
    process.exit(1)
})
