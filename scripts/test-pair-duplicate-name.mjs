const fetch = global.fetch;

(async () => {
  try {
    const res1 = await fetch('http://localhost:4000/api/pc/pair', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pc_id:'pc-test-a', pc_name:'pc-common'})});
    console.log('response1', res1.status, await res1.json());

    const res2 = await fetch('http://localhost:4000/api/pc/pair', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pc_id:'pc-test-b', pc_name:'pc-common'})});
    console.log('response2', res2.status, await res2.json());
  } catch (err) {
    console.error(err);
  }
})();