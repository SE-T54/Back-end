import app from './app.js'


const port = process.env.PORT || 3000;

async function start()
{
    await app.connect();
    app.app.listen(port, "0.0.0.0", () => console.log(`Super frigo listening on ${port}!`));
}

start();
