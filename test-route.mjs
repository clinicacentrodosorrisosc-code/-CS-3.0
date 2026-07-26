import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://localhost:3001/foo/bar');
  console.log(res.status, await res.text());
}
test();
