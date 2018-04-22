import {app} from "./app";

const port: number = parseFloat(process.env.PORT || '') || 3000;

app.set('port', port);

export const server = app.listen(port, () => {
  // Success callback
  console.log(`Listening at http://localhost:${port}/`);
});
