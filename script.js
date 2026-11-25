const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

// Reveal content as it enters the viewport.
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('shown');
      entry.target.querySelectorAll?.('.typed-lines p').forEach((line, i) => {
        setTimeout(() => line.classList.add('visible'), i * 650);
      });
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .18 });
$$('.reveal, .story-copy').forEach(el => revealObserver.observe(el));

// Candle interaction: button fallback always works.
function extinguishCandles() {
  $$('.candle').forEach((c, i) => setTimeout(() => c.classList.add('out'), i * 180));
  $('#wishMessage').textContent = 'May this year bring you everything your heart has been quietly wishing for. Happy Birthday, Sarthuuu! ♥';
  $('#blowButton').textContent = 'Wish made ✦';
  confetti();
}
$('#blowButton').addEventListener('click', extinguishCandles);

// Microphone blow detection uses audio volume only; audio is not recorded or stored.
let audioContext, micStream, micFrame;
$('#micButton').addEventListener('click', async () => {
  const status = $('#micStatus');
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Microphone is not available here. Use the candle button instead.';
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    status.textContent = 'Microphone is on — blow gently towards your device.';
    $('#micButton').textContent = 'Listening…';
    let loudFrames = 0;
    const listen = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) sum += Math.abs(value - 128);
      const volume = sum / data.length;
      loudFrames = volume > 13 ? loudFrames + 1 : Math.max(0, loudFrames - 1);
      if (loudFrames > 10) {
        extinguishCandles();
        stopMic();
        status.textContent = 'Wish received. ✨';
        return;
      }
      micFrame = requestAnimationFrame(listen);
    };
    listen();
  } catch {
    status.textContent = 'Microphone permission was not granted. The button still works!';
  }
});
function stopMic() {
  if (micFrame) cancelAnimationFrame(micFrame);
  micStream?.getTracks().forEach(track => track.stop());
  audioContext?.close();
  $('#micButton').textContent = 'Use microphone';
}
window.addEventListener('beforeunload', stopMic);

// Small celebratory confetti burst.
function confetti() {
  for (let i=0; i<75; i++) {
    const bit = document.createElement('i');
    bit.style.cssText = `position:fixed;z-index:45;left:${Math.random()*100}vw;top:-12px;width:${4+Math.random()*5}px;height:${7+Math.random()*8}px;background:${['#c6a16a','#f0d9a7','#8c3e3e','#eee0c5'][i%4]};opacity:.9;pointer-events:none;border-radius:2px;`;
    document.body.appendChild(bit);
    const x = (Math.random()-.5)*220, duration = 1800+Math.random()*1800;
    bit.animate([{transform:'translate3d(0,0,0) rotate(0)',opacity:1},{transform:`translate3d(${x}px,105vh,0) rotate(${Math.random()*900}deg)`,opacity:0}],{duration,easing:'cubic-bezier(.2,.7,.3,1)'});
    setTimeout(()=>bit.remove(),duration);
  }
}

// Gallery lightbox and temporary local uploads.
const lightbox = $('#lightbox');
function openLightbox(src, caption) {
  $('#lightboxImage').src = src;
  $('#lightboxCaption').textContent = caption || '';
  lightbox.classList.add('open');
}
$('#lightboxClose').addEventListener('click',()=>lightbox.classList.remove('open'));
lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.classList.remove('open')});
$('#galleryGrid').addEventListener('click',e=>{
  const item=e.target.closest('.gallery-item');
  if (!item) return;
  const img=$('img',item);
  if (img) openLightbox(img.src,item.dataset.caption);
});
$('#photoUpload').addEventListener('change',e=>{
  [...e.target.files].forEach((file,index)=>{
    if(!file.type.startsWith('image/')) return;
    const url=URL.createObjectURL(file);
    const item=document.createElement('button');
    item.className='gallery-item';
    item.dataset.caption=file.name.replace(/\.[^.]+$/,'');
    const img=document.createElement('img'); img.src=url; img.alt=item.dataset.caption;
    const label=document.createElement('span'); label.textContent='NEW MEMORY';
    item.append(img,label); $('#galleryGrid').prepend(item);
  });
  e.target.value='';
});

// Per-page photo uploads. Images are resized before saving to browser storage.
const photoSlots = {
  photoHero: { selector: '.hero-content', insertAfter: '.signature', label: 'Opening page' },
  photoCelebrate: { selector: '.cake-stage', append: true, label: 'Birthday celebration' },
  photoStory: { selector: '.story-wrap', append: true, label: 'Our story' },
  photoChapter1: { selector: '.moment-card:nth-of-type(1) .photo-placeholder', replace: true, label: 'First chapter' },
  photoChapter2: { selector: '.moment-card:nth-of-type(2) .photo-placeholder', replace: true, label: 'The little things' },
  photoChapter3: { selector: '.moment-card:nth-of-type(3) .photo-placeholder', replace: true, label: 'The connection' },
  photoLetter: { selector: '.letter-paper', insertAfter: '.letter-signoff', label: 'English letter' },
  photoHindi: { selector: '.hindi-paper', insertAfter: '.hindi-final', label: 'Hindi shayari' },
  photoGallery: { selector: '.gallery-intro', insertAfter: null, label: 'Memories' },
  photoFinal: { selector: '.final-section', insertBefore: '.back-top', label: 'Final birthday page' }
};
let pagePhotos = {};
const photoPositions = {};
function applyPhotoPosition(id, position = 'center') {
  photoPositions[id] = position;
  const config = photoSlots[id];
  if (!config) return;
  const target = document.querySelector(config.selector);
  if (!target) return;
  const photo = config.replace ? target : target.querySelector(`:scope > .page-photo[data-photo-id=\"${id}\"]`);
  if (!photo) return;
  photo.dataset.align = position;
  if (config.replace) {
    photo.style.width = position === 'center' ? '100%' : '78%';
    photo.style.marginLeft = position === 'right' ? 'auto' : '0';
    photo.style.marginRight = position === 'left' ? 'auto' : '0';
  } else if (id === 'photoCelebrate') {
    photo.style.left = position === 'left' ? '2%' : position === 'center' ? 'calc(50% - 85px)' : 'auto';
    photo.style.right = position === 'right' ? '2%' : 'auto';
  } else {
    photo.style.marginLeft = position === 'left' ? '0' : 'auto';
    photo.style.marginRight = position === 'right' ? '0' : 'auto';
  }
}
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.onload = () => {
        const max = 1400, scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderPagePhoto(id, src) {
  const config = photoSlots[id];
  if (!config) return;
  const target = document.querySelector(config.selector);
  if (!target) return;
  if (config.replace) {
    target.innerHTML = '';
    if (src) {
      const img = document.createElement('img'); img.src = src; img.alt = config.label;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-page-photo'; remove.textContent = 'Remove photo';
      remove.addEventListener('click', (event) => {
        event.stopPropagation(); delete pagePhotos[id]; renderPagePhoto(id, null);
        const input = document.getElementById(id); if (input) input.value = '';
        const saved = JSON.parse(localStorage.getItem('sarthuuuBirthdayEdits') || '{}');
        delete saved[id]; localStorage.setItem('sarthuuuBirthdayEdits', JSON.stringify(saved));
      });
      target.append(img, remove); target.classList.add('has-photo');
      applyPhotoPosition(id, photoPositions[id] || 'center');
    } else {
      target.textContent = id === 'photoChapter1' ? 'YOUR FIRST HOSTEL MEMORY' : id === 'photoChapter2' ? 'A RANDOM, HAPPY DAY' : 'YOUR FAVOURITE PHOTO';
      target.classList.remove('has-photo');
    }
    return;
  }
  const existing = target.querySelector(`:scope > .page-photo[data-photo-id="${id}"]`);
  existing?.remove();
  if (!src) return;
  const figure = document.createElement('figure');
  figure.className = 'page-photo'; figure.dataset.photoId = id;
  const img = document.createElement('img'); img.src = src; img.alt = `${config.label} photograph`;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-page-photo'; remove.textContent = 'Remove photo';
  remove.addEventListener('click', () => {
    delete pagePhotos[id]; renderPagePhoto(id, null);
    const input = document.getElementById(id); if (input) input.value = '';
    const saved = JSON.parse(localStorage.getItem('sarthuuuBirthdayEdits') || '{}');
    delete saved[id]; localStorage.setItem('sarthuuuBirthdayEdits', JSON.stringify(saved));
  });
  figure.append(img, remove);
  applyPhotoPosition(id, photoPositions[id] || 'center');
  if (config.insertAfter) {
    const anchor = target.querySelector(config.insertAfter);
    if (anchor) anchor.insertAdjacentElement('afterend', figure); else target.appendChild(figure);
  } else if (config.insertBefore) {
    const anchor = target.querySelector(config.insertBefore);
    if (anchor) target.insertBefore(figure, anchor); else target.appendChild(figure);
  } else target.appendChild(figure);
}
Object.entries(photoSlots).forEach(([id]) => {
  const positionInput = document.getElementById(`position_${id}`);
  if (positionInput) {
    positionInput.addEventListener('change', () => {
      applyPhotoPosition(id, positionInput.value);
      const msg = document.getElementById('editorStatus');
      if (msg) msg.textContent = `${photoSlots[id].label} photo location updated. Press Save changes.`;
    });
  }
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      pagePhotos[id] = await compressPhoto(file);
      renderPagePhoto(id, pagePhotos[id]);
      const msg = document.getElementById('editorStatus');
      if (msg) msg.textContent = `${photoSlots[id].label} photo added. Press Save changes to keep it.`;
    } catch (error) {
      const msg = document.getElementById('editorStatus'); if (msg) msg.textContent = error.message;
    }
  });
});

// Music control is ready for an optional local audio file.
const music = $('#backgroundMusic');
const musicToggle = $('#musicToggle');
let musicReady = false;
musicToggle.addEventListener('click', async()=>{
  if(!musicReady){
    music.src='assets/ambient.mp3';
    music.volume=.25;
    musicReady=true;
  }
  try {
    if(music.paused){ await music.play(); musicToggle.innerHTML='♫ <span>Music on</span>'; }
    else { music.pause(); musicToggle.innerHTML='♫ <span>Music off</span>'; }
  } catch { musicToggle.innerHTML='♫ <span>Add music file</span>'; }
});

// Ambient star particles.
for(let i=0;i<32;i++){
  const star=document.createElement('span');
  star.textContent=i%4===0?'✦':'·';
  star.style.cssText=`position:fixed;z-index:0;pointer-events:none;left:${Math.random()*100}%;top:${Math.random()*100}%;color:#c9a36c;opacity:${.12+Math.random()*.35};font-size:${7+Math.random()*12}px;animation:float ${5+Math.random()*8}s ease-in-out infinite;animation-delay:${-Math.random()*8}s`;
  document.body.appendChild(star);
}

// QUICK EDITOR: lets the site owner personalize text without opening code.
(() => {
  const panel = document.getElementById('editorPanel');
  const backdrop = document.getElementById('editorBackdrop');
  const status = document.getElementById('editorStatus');
  const themeFields = ['editThemeCelebrateBg','editThemeCelebrateAccent','editThemeStoryBg','editThemeStoryAccent','editThemeLetterBg','editThemeLetterAccent','editThemeHindiBg','editThemeHindiAccent','editThemeGalleryBg','editThemeGalleryAccent','editThemeFinalBg','editThemeFinalAccent'];
  const fields = ['editFriend','editTagline','editOpening','editStory','editChapter1Title','editChapter1Text','editChapter2Title','editChapter2Text','editChapter3Title','editChapter3Text','editEnglishLetter','editHindiLetter','editFinal','editAccent',...themeFields];
  const $id = id => document.getElementById(id);
  const letterParagraphs = [...document.querySelectorAll('.letter-body p')].map(p => p.textContent.trim());
  const defaults = {
    editFriend:'Sarthuuuuu', editTagline:'Lallaaaaa',
    editOpening:'Some people enter your life unexpectedly...\nSomehow, they become a part of your favourite memories.',
    editStory:[...document.querySelectorAll('.typed-lines p')].map(p=>p.textContent).join('\n'),
    editChapter1Title:document.querySelectorAll('.moment-card p')[0]?.textContent || 'The first chapter',
    editChapter1Text:document.querySelectorAll('.moment-card small')[0]?.textContent || '',
    editChapter2Title:document.querySelectorAll('.moment-card p')[1]?.textContent || 'The little things',
    editChapter2Text:document.querySelectorAll('.moment-card small')[1]?.textContent || '',
    editChapter3Title:document.querySelectorAll('.moment-card p')[2]?.textContent || 'The connection',
    editChapter3Text:document.querySelectorAll('.moment-card small')[2]?.textContent || '',
    editEnglishLetter:letterParagraphs.join('\n\n'),
    editHindiLetter:[...document.querySelectorAll('#hindiPoem p')].map(p=>p.textContent).filter(t=>!t.startsWith('[')).join('\n\n'),
    editFinal:"Here's to another year of memories, madness, laughter and endless stories.\nStay the same idiot you've always been.\nKeep smiling. Keep growing. Keep being YOU.",
    editAccent:'#b9955e',
    editThemeCelebrateBg:'#100d0c', editThemeCelebrateAccent:'#c6a16a',
    editThemeStoryBg:'#0b0a09', editThemeStoryAccent:'#c6a16a',
    editThemeLetterBg:'#15110e', editThemeLetterAccent:'#b9955e',
    editThemeHindiBg:'#0b0908', editThemeHindiAccent:'#c6a16a',
    editThemeGalleryBg:'#0e0c0b', editThemeGalleryAccent:'#c6a16a',
    editThemeFinalBg:'#080808', editThemeFinalAccent:'#c6a16a'
  };
  // Imported browser backup is now the shipped default website content.
  Object.assign(defaults, {"editFriend":"Sarthuuuuu","editTagline":"Lallaaaaa","editOpening":"Some people enter your life unexpectedly...\nSomehow, they become a part of your favourite memories.\n      \n\n","editStory":"We met as two strangers in a hostel.\nNeither of us knew what was about to begin.\nFrom random conversations to endless memories...\nFrom being complete strangers to becoming an irreplaceable part of each other's lives.\nAnd just like that, the endless connection began.","editChapter1Title":"The first chapter","editChapter1Text":"Where two strangers crossed paths.\nदो अजनबी मिले थे एक अनजाने सफ़र में,\nना कोई पहचान थी, ना कोई ख़ास वजह थी मिलने में।\nफिर कुछ बातें हुईं, कुछ हँसी के पल जुड़े,\nऔर देखते ही देखते दो अजनबी, एक-दूसरे के अपने बन गए। ❤️","editChapter2Title":"The little things","editChapter2Text":"Conversations that became memories.\nYou were BJP, and I was Congress,\nEvery little conversation turned into a political mess.\nWe argued like rivals, laughed like fools,\nNever realizing those silly debates were making memories so beautiful","editChapter3Title":"The connection","editChapter3Text":"Some people just become home.\nSome people enter your life as strangers,\nbut slowly become your comfort, your safe place, and your home.\nAnd somewhere between all the laughter, silly fights, and endless conversations,\nyou became one of those people. ❤️","editEnglishLetter":"I don't know what you think of me, or what place I hold in your life. Maybe I don't even know how you describe our friendship.\n\nBut one thing I know for sure is that you are one of the best people life has introduced me to.\n\nWe met at a hostel, without knowing that a random meeting would turn into something this meaningful.\n\nI never expected that someone I barely knew would become someone whose presence, conversations, and existence would eventually mean so much to me.\n\nWe've had our own moments, our stupid conversations, endless laughter, random memories, and days that probably seemed ordinary at the time but now mean a lot.\n\nI might not always express it, and I might not always find the right words, but I genuinely wish the best for you.\n\nI hope life gives you everything you've ever dreamed of. I hope you find reasons to smile even on difficult days, strength when things get complicated, and people who appreciate you for exactly who you are.\n\nI don't know where life will take us or how things will change with time.\n\nBut whenever we look back at these days, I hope we remember them with the biggest smiles.\n\nThank you for being a part of my story, Sarthuuu.\n\nYou aren't just someone I met at a hostel.\n\nYou're someone I'm genuinely glad I met.\n\nAnd no matter how casually I say it, you'll always be one of my favourite people.","editHindiLetter":"सबसे पहले तो जन्मदिन की ढेर सारी शुभकामनाएँ मेरे भाई!\n\nसमझ नहीं आ रहा कहाँ से शुरू करूँ,  \nकैसे अपने दिल की बातें लफ़्ज़ों में बयाँ करूँ।  \nचल, आज फिर वही पुरानी कहानी दोहराते हैं,  \nजहाँ दो अनजान से लड़के मिले और एक-दूसरे को चूतिया बताते हैं।\n\nना पहले कोई ख़ास बात थी, ना कोई पहचान थी,  \nतू मेरे लिए चूतिया, मैं तेरे लिए चूतिया था!  \nपर कहते हैं ना, कुछ रिश्ते भगवान बनाकर भेजता है,  \nऔर कुछ लोग बिना किसी वजह के दिल में जगह बना लेते हैं।\n\nयाद है वो पहली बार, जब मैंने तुझसे कुछ कहा था,  \nपहली बार तूने मुझे गले लगाया था।  \nऔर जब जाते-जाते मैंने तुझसे कहा था,  \n\"तू अच्छा बंदा है भाई...\"  \nकहते हैं नशे में इंसान अक्सर सच बोल जाता है,  \nशायद उस दिन तेरी ज़ुबान से दिल का सच निकल आया था।\n\nबहुत कुछ है कहने को, बहुत सी कहानियाँ हैं,  \nकुछ यादें लफ़्ज़ों में हैं, कुछ बस दिल में छुपी निशानियाँ हैं।  \nपर छोड़, आज उन सभी क़िस्सों को रहने देते हैं,  \nआज बस तेरे नाम कुछ दिल की बातें लिखने देते हैं।\n\n**एक बात कहूँ मेरे भाई,**\n\nज़िंदगी में हर रोज़ सब कुछ अच्छा नहीं होता,  \nहर इंसान अपने दिल की बात कह नहीं पाता।  \nपर याद रखना, जब कभी ख़ुद से ही हारने लगे,  \nतो अपने अंदर के उस इंसान को मत खोना,  \nजो हर मुश्किल के बाद भी मुस्कुराना जानता है।\n\nतू फ़ालतू सोचना थोड़ा कम कर दिया कर,  \nहर बात को दिल से लगाना छोड़ दिया कर।  \nज़िंदगी बहुत ख़ूबसूरत है मेरे भाई,  \nइसे बेकार की फ़िक्रों में बर्बाद मत किया कर।\n\nमुझे नहीं पता आने वाले वक़्त में ज़िंदगी हमें कहाँ ले जाएगी,  \nकितनी मुलाक़ातें होंगी और कितनी दूरियाँ आएँगी।  \nबस इतना चाहता हूँ कि जब भी कभी पीछे मुड़कर देखें,  \nतो चेहरे पर एक मुस्कान हो और दिल कहे कि  \n**यार, क्या ख़ूबसूरत वक़्त था वो!**\n\nतू ख़ुश रह, आगे बढ़, ख़ूब तरक़्क़ी कर,  \nअपने सारे सपने पूरे कर।  \nऔर कभी ख़ुद को अकेला मत समझना,  \nकुछ लोग हमेशा तेरी ख़ुशी में ख़ुश रहेंगे।\n\nबाक़ी तो सब बढ़िया है मेरे भाई!  \nएक बार फिर जन्मदिन की ढेर सारी बधाइयाँ!\n\n**जन्मदिन मुबारक हो ! ❤️**","editFinal":"Here's to another year of memories, madness, laughter and endless stories.\nStay the same idiot you've always been.\nKeep smiling. Keep growing. Keep being YOU.","editAccent":"#b9955e","editThemeCelebrateBg":"#100d0c","editThemeCelebrateAccent":"#c6a16a","editThemeStoryBg":"#0b0a09","editThemeStoryAccent":"#c6a16a","editThemeLetterBg":"#15110e","editThemeLetterAccent":"#b9955e","editThemeHindiBg":"#0b0908","editThemeHindiAccent":"#c6a16a","editThemeGalleryBg":"#0e0c0b","editThemeGalleryAccent":"#c6a16a","editThemeFinalBg":"#080808","editThemeFinalAccent":"#c6a16a"});
  function open(){panel.classList.add('open');backdrop.classList.add('open');}
  function close(){panel.classList.remove('open');backdrop.classList.remove('open');}
  document.getElementById('editLaunch').addEventListener('click',open);
  document.getElementById('editorClose').addEventListener('click',close);
  backdrop.addEventListener('click',close);
  function setText(selector,text){const el=document.querySelector(selector);if(el)el.textContent=text;}
  function apply(data){
    const friend=data.editFriend||defaults.editFriend, tagline=data.editTagline||defaults.editTagline;
    const opening=(data.editOpening||'').split('\n');
    const prelude=document.querySelectorAll('.hero-prelude');
    if(prelude[0])prelude[0].textContent=opening[0]||'';
    if(prelude[1])prelude[1].textContent=opening[1]||'';
    const heroName=document.querySelector('.hero h1 em'); if(heroName)heroName.textContent=friend+'!';
    const finalName=document.querySelector('.final-section h1 em');if(finalName)finalName.textContent=friend+'!';
    document.querySelectorAll('.signature span').forEach(el=>el.textContent=tagline);
    const story=(data.editStory||'').split('\n');
    const storyBox=document.querySelector('.typed-lines');storyBox.innerHTML='';
    story.forEach((line,i)=>{const p=document.createElement('p');p.textContent=line;if(i===story.length-1)p.className='gold-line visible';else p.className='visible';storyBox.appendChild(p)});
    for(let i=1;i<=3;i++){
      const card=document.querySelectorAll('.moment-card')[i-1];
      if(card){
        card.querySelector('p').textContent=data[`editChapter${i}Title`] ?? defaults[`editChapter${i}Title`];
        card.querySelector('small').textContent=data[`editChapter${i}Text`] ?? defaults[`editChapter${i}Text`];
      }
    }
    const letter=document.querySelector('.letter-body');letter.innerHTML='';
    (data.editEnglishLetter||'').split(/\n\s*\n/).filter(Boolean).forEach(line=>{const p=document.createElement('p');p.textContent=line;letter.appendChild(p)});
    const signoff=document.querySelector('.letter-signoff');signoff.innerHTML='With lots of love,<br><span></span> ♥';signoff.querySelector('span').textContent='Yours '+tagline;
    const poem=document.getElementById('hindiPoem');poem.innerHTML='';
    (data.editHindiLetter||'').split(/\n\s*\n/).filter(Boolean).forEach(line=>{const p=document.createElement('p');p.textContent=line;poem.appendChild(p)});
    const final=(data.editFinal||'').split('\n');
    document.querySelector('.final-section h2').textContent=final[0]||'';
    document.querySelector('.final-lines').innerHTML=(final.slice(1).join('<br>'));
    document.documentElement.style.setProperty('--user-accent',data.editAccent||defaults.editAccent);
    document.querySelectorAll('.eyebrow,.section-kicker,.hindi-final,.signature span').forEach(el=>el.style.setProperty('color',data.editAccent||defaults.editAccent));
    const pageThemes = [
      ['celebrate','editThemeCelebrateBg','editThemeCelebrateAccent'],
      ['story','editThemeStoryBg','editThemeStoryAccent'],
      ['letter','editThemeLetterBg','editThemeLetterAccent'],
      ['hindi','editThemeHindiBg','editThemeHindiAccent'],
      ['gallery','editThemeGalleryBg','editThemeGalleryAccent'],
      ['final','editThemeFinalBg','editThemeFinalAccent']
    ];
    pageThemes.forEach(([sectionId,bgKey,accentKey])=>{
      const section=document.getElementById(sectionId);
      if(!section) return;
      const bg=data[bgKey]||defaults[bgKey], accent=data[accentKey]||defaults[accentKey];
      section.style.backgroundColor=bg;
      section.querySelectorAll('.eyebrow,.section-kicker,h2 em,h1 em,.moment>span,.moment-card p,.wish-message,.hindi-final').forEach(el=>el.style.color=accent);
      section.style.setProperty('--page-accent',accent);
    });
  }
  function readFields(){const out={};fields.forEach(id=>out[id]=$id(id).value);return out;}
  fields.forEach(id=>$id(id).addEventListener('input',()=>apply(readFields())));
  function load(data){fields.forEach(id=>$id(id).value=data[id]??defaults[id]);apply(data);}
  document.getElementById('saveEdits').addEventListener('click',()=>{
    const data={...readFields(),...pagePhotos};
    Object.keys(photoSlots).forEach(id => data[`position_${id}`] = photoPositions[id] || 'center');
    apply(data);
    try{localStorage.setItem('sarthuuuBirthdayEdits',JSON.stringify(data));status.textContent='Saved in this browser. Your edits will return when you reopen this site here.';}
    catch{status.textContent='Preview updated, but browser storage is full. Export a text backup.';}
  });
  document.getElementById('resetEdits').addEventListener('click',()=>{
    localStorage.removeItem('sarthuuuBirthdayEdits');pagePhotos={};Object.keys(photoSlots).forEach(id=>{photoPositions[id]='center';renderPagePhoto(id,null);const input=$id(id);if(input)input.value='';const pos=document.getElementById(`position_${id}`);if(pos)pos.value='center';});load(defaults);status.textContent='Original website text and photos restored.';
  });
  document.getElementById('exportEdits').addEventListener('click',()=>{
    const backup={...readFields(),...pagePhotos};Object.keys(photoSlots).forEach(id=>backup[`position_${id}`]=photoPositions[id]||'center');
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sarthuuu-website-text-backup.json';a.click();URL.revokeObjectURL(a.href);
    status.textContent='Text backup downloaded.';
  });
  const saved=localStorage.getItem('sarthuuuBirthdayEdits');
  const savedData=saved?JSON.parse(saved):defaults;
  load(savedData);
  Object.keys(photoSlots).forEach(id=>{
    const position = savedData[`position_${id}`] || 'center';
    photoPositions[id] = position;
    const positionInput = document.getElementById(`position_${id}`); if (positionInput) positionInput.value = position;
    if (savedData[id]) { pagePhotos[id]=savedData[id]; renderPagePhoto(id, savedData[id]); }
  });
})();
