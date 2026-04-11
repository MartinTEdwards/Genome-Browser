// Quick test script to load GCF_020525545.1 and surface any errors
const res = await fetch('http://localhost:3000/api/genomes/load', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accession: 'GCF_020525545.1',
    organismName: 'Klebsiella variicola subsp. variicola (F2R9T)',
  }),
});
const text = await res.text();
console.log('Status:', res.status);
console.log('Body:', text);
