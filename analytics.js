/* analytics.js — Google Analytics 4 loader.
   This is the ONLY place the measurement ID lives. Pages include this file
   with a single ID-free <script async src="/morcypher/analytics.js"></script>
   line, so changing the property is a one-line edit here. */
const GA_ID = 'G-B6D0XJB93H';

const s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
document.head.appendChild(s);

window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', GA_ID);
