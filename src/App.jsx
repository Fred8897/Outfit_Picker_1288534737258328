import React, { useState, useEffect, useRef } from 'react';
import heic2any from 'heic2any';
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

const FILTER_OPTIONS = {
  temperature: ['hot', 'medium', 'cold'],
  weather: ['sun', 'rain', 'cloudy', 'snow'],
  colors: ['black', 'white', 'beige', 'navy', 'blue', 'red', 'pink', 'brown', 'green', 'grey'],
  occasion: ['work', 'casual', 'party', 'lounge', 'formal', 'workout']
};

const INITIAL_WARDROBE = [];

const LAYERS = ['coats', 'tops', 'bottoms', 'shoes', 'bags'];
const LAYER_LABELS = { coats: 'Coats', tops: 'Tops', bottoms: 'Bottoms', shoes: 'Shoes', bags: 'Bags', 'try-on': 'Virtual Try-On' };

const THEMES = [
  { id: 'light', label: 'Light', bg: '#F5F3EE', text: '#17140F', card: '#FFFFFF', accent: '#2F4A3A' },
  { id: 'dark', label: 'Dark', bg: '#1C1A17', text: '#F3EFE6', card: '#2B2925', accent: '#E4DFD1' },
  { id: 'botanical', label: 'Botanical', bg: '#23332A', text: '#F3EFE6', card: '#1B2620', accent: '#A3BFA8' },
  { id: 'oxblood', label: 'Oxblood', bg: '#4A1C24', text: '#F3EFE6', card: '#341319', accent: '#E8B4BC' },
  { id: 'midnight', label: 'Midnight', bg: '#161F33', text: '#F3EFE6', card: '#0F1524', accent: '#9AB2E6' },
];

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const alpha = (hex, a) => `${hex}${a}`;

const secureFetch = async (url, options = {}) => {
  const password = localStorage.getItem('wardrobe_password') || '';
  const headers = {
    'Content-Type': 'application/json',
    'x-app-password': password,
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  return response;
};

const normalizeItem = (item) => {
  return {
    ...item,
    id: item.id || item.image || `item_${Math.random()}`,
    occasion: Array.isArray(item.occasion) ? item.occasion : (item.event ? [item.event] : ['casual']),
    colors: Array.isArray(item.colors) ? item.colors : (item.color ? [item.color] : ['black']),
    temperature: Array.isArray(item.temperature) ? item.temperature : (item.weather === 'cold' ? ['cold'] : (item.weather === 'hot' ? ['hot'] : ['medium'])),
    weather: Array.isArray(item.weather) ? item.weather : (item.weather ? [item.weather] : ['sun', 'cloudy']),
    hiddenTags: Array.isArray(item.hiddenTags) ? item.hiddenTags : []
  };
};

const convertToStandardImageBlob = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => reject(new Error('Failed to load image into canvas helper'));
    img.src = URL.createObjectURL(file);
  });
};

const resizeImageForAI = (fileBlob, maxDimension = 1024) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]); 
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(fileBlob);
  });
};

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const CameraIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1-1.6a1.5 1.5 0 0 1 1.28-.7h4.04a1.5 1.5 0 0 1 1.28.7l1 1.6h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.2"/></svg>;
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>;
const SparkIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 3.9 1.9 6.4 4.8 7.3-2.9.9-4.2 3.4-4.8 7.3-.6-3.9-1.9-6.4-4.8-7.3C10.1 8.4 11.4 5.9 12 2Z"/><path d="M19 14.5c.3 1.7.9 2.7 2.2 3.1-1.3.4-1.9 1.4-2.2 3.1-.3-1.7-.9-2.7-2.2-3.1 1.3-.4 1.9-1.4 2.2-3.1Z"/></svg>;
const PaletteIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.83 2-2 0-.5-.2-.95-.5-1.28-.3-.34-.5-.79-.5-1.22 0-1.1.9-1.9 2-1.9h1.7c2 0 3.3-1.7 3.3-3.6C19.5 6.2 16.1 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7" r="1" fill="currentColor" stroke="none"/></svg>;
const CheckIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;
const FilterIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const SaveIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const ExpandIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const UploadIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;

const COLOR_CLASHES = {
  'red': ['pink', 'orange', 'green'], 'pink': ['red', 'orange'], 'brown': ['black', 'navy'],
  'black': ['brown', 'navy'], 'navy': ['black', 'brown']
};

const areColorsCompatible = (c1Arr, c2Arr) => {
  if (!c1Arr || !c2Arr || !c1Arr.length || !c2Arr.length) return true;
  for (const c1 of c1Arr) {
    for (const c2 of c2Arr) {
      const n1 = c1.toLowerCase(); const n2 = c2.toLowerCase();
      if (COLOR_CLASHES[n1] && COLOR_CLASHES[n1].includes(n2)) return false;
      if (COLOR_CLASHES[n2] && COLOR_CLASHES[n2].includes(n1)) return false;
    }
  }
  return true;
};

const getThemeStyles = (theme) => ({
  appContainer: { backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', padding: '20px', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { margin: 0, fontFamily: 'Fraunces, serif', letterSpacing: '0.02em', color: theme.text }, 
  headerRight: { display: 'flex', gap: '10px' },
  iconBtn: { background: 'none', border: 'none', color: theme.text, cursor: 'pointer' },
  addBtn: { backgroundColor: theme.accent, color: theme.bg, border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' },
  paletteScrim: { position: 'fixed', inset: 0, zIndex: 10 },
  palettePopover: { position: 'absolute', top: '100%', right: 0, backgroundColor: theme.card, padding: '10px', borderRadius: '8px', zIndex: 11, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  paletteTitle: { margin: '0 0 8px', fontSize: '12px', fontWeight: 'bold' },
  swatch: (bg, isActive, text) => ({ backgroundColor: bg, border: isActive ? `2px solid ${text}` : 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
  tabsContainer: { display: 'flex', borderBottom: `1px solid ${theme.text}30`, margin: '20px 0 10px' },
  tabBtn: (isActive) => ({ flex: 1, background: 'none', border: 'none', padding: '12px', fontSize: '16px', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? theme.text : `${theme.text}80`, borderBottom: isActive ? `2px solid ${theme.accent}` : 'none', cursor: 'pointer' }),
  filterRow: { display: 'flex', gap: '10px', margin: '10px 0 20px', alignItems: 'center' },
  filterTab: (isActive) => ({ backgroundColor: isActive ? theme.accent : theme.card, color: isActive ? theme.bg : theme.text, border: 'none', padding: '6px 12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }),
  clearBtn: { background: 'none', border: 'none', color: theme.text, textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' },
  magicBtn: { backgroundColor: theme.text, color: theme.bg, border: 'none', padding: '6px 12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' },
  layerSection: { marginBottom: '16px' },
  layerLabelRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  layerLabel: { fontWeight: 'bold', fontSize: '14px' },
  itemCount: { fontSize: '12px', opacity: 0.7 },
  carouselTrack: { display: 'flex', overflowX: 'auto', padding: '30px calc(50% - 60px)', scrollSnapType: 'x mandatory', position: 'relative', alignItems: 'center', height: '180px' },
  itemCard: (isSelected) => ({ width: '100px', height: '100px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', position: 'relative', border: isSelected ? `4px solid ${theme.accent}` : 'none', cursor: 'pointer', backgroundColor: theme.card, scrollSnapAlign: 'center', transition: 'all 0.3s', opacity: isSelected ? 1 : 0.4, transform: isSelected ? 'scale(1.5)' : 'scale(1)', boxShadow: isSelected ? `0 12px 28px ${theme.accent}88` : 'none', boxSizing: 'border-box', margin: '0 15px' }),
  noneCard: (isSelected) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: isSelected ? alpha(theme.accent, '20') : 'transparent', color: theme.text }),
  editCardBtn: { position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', zIndex: 2 },
  actionRow: { display: 'flex', gap: '10px', marginTop: '20px' },
  secondaryBtn: (disabled) => ({ flex: 1, backgroundColor: 'transparent', border: `2px solid ${theme.accent}`, color: theme.text, padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }),
  primaryBtn: { flex: 2, backgroundColor: theme.accent, color: theme.bg, border: 'none', padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBox: { backgroundColor: theme.card, padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', color: theme.text, maxHeight: '85vh', overflowY: 'auto' },
  modalTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalHeading: { margin: 0, fontSize: '18px' },
  modalClose: { background: 'none', border: 'none', color: theme.text, cursor: 'pointer' },
  modalBody: { margin: '0 0 16px', fontSize: '14px', opacity: 0.8 },
  filterChip: (isSelected) => ({ backgroundColor: isSelected ? theme.accent : 'transparent', color: isSelected ? theme.bg : theme.text, border: `1px solid ${theme.accent}`, padding: '4px 8px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px' }),
  cancelBtn: { flex: 1, backgroundColor: 'transparent', border: `1px solid ${theme.text}`, color: theme.text, padding: '8px', borderRadius: '8px', cursor: 'pointer' },
  confirmBtn: { flex: 1, backgroundColor: theme.accent, color: theme.bg, border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' },
  uploadArea: { border: `2px dashed ${theme.text}40`, borderRadius: '12px', padding: '30px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  inputField: { width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${theme.text}40`, backgroundColor: 'transparent', color: theme.text, marginBottom: '16px', boxSizing: 'border-box' },
  selectField: { width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${theme.text}40`, backgroundColor: theme.card, color: theme.text, marginBottom: '16px', boxSizing: 'border-box' },
  outfitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', paddingBottom: '20px' }
});

const ExpandedOutfitModal = ({ items, outfitTitle, theme, styles, onClose, onLoadToDressingRoom, onDuplicateToDressingRoom }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex % items.length];

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: theme.bg, color: theme.text, zIndex: 250, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: '24px' }}>{outfitTitle || 'Outfit Details'}</h2>
          <span style={{ fontSize: '13px', opacity: 0.7 }}>Item {currentIndex + 1} of {items.length}</span>
        </div>
        <button onClick={onClose} style={{ ...styles.iconBtn, fontSize: '22px' }}><CloseIcon /></button>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card, borderRadius: '16px', margin: '16px 0', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.25)', padding: '20px' }}>
        <img src={currentItem.image} alt={currentItem.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'all 0.3s ease' }} />

        {items.length > 1 && (
          <>
            <button onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)} style={{ position: 'absolute', left: '16px', backgroundColor: alpha(theme.bg, '85'), border: `1px solid ${theme.text}20`, color: theme.text, borderRadius: '50%', width: '46px', height: '46px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#10094;</button>
            <button onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)} style={{ position: 'absolute', right: '16px', backgroundColor: alpha(theme.bg, '85'), border: `1px solid ${theme.text}20`, color: theme.text, borderRadius: '50%', width: '46px', height: '46px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#10095;</button>
          </>
        )}

        {currentItem.layer === 'try-on' && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: theme.accent, color: theme.bg, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SparkIcon /> AI Virtual Try-On
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0 12px', alignItems: 'center', justifyContent: items.length < 5 ? 'center' : 'flex-start' }} className="hide-scrollbar">
        {items.map((item, idx) => (
          <div key={item.id || idx} onClick={() => setCurrentIndex(idx)} style={{ width: '68px', height: '68px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', border: idx === currentIndex ? `3px solid ${theme.accent}` : `1px solid ${theme.text}30`, backgroundColor: theme.card, cursor: 'pointer', opacity: idx === currentIndex ? 1 : 0.6, transform: idx === currentIndex ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.2s ease', position: 'relative', boxSizing: 'border-box' }}>
            <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            {item.layer === 'try-on' && (
              <div style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: theme.accent, borderRadius: '50%', width: '10px', height: '10px' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: '18px' }}>{currentItem.name || 'Outfit Item'}</h4>
        <span style={{ fontSize: '13px', opacity: 0.7 }}>Category: {LAYER_LABELS[currentItem.layer] || 'Item'} {currentItem.colors && currentItem.colors.length > 0 ? ` • ${currentItem.colors.join(', ')}` : ''}</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {onLoadToDressingRoom && <button onClick={onLoadToDressingRoom} style={styles.primaryBtn}>Load into Dressing Room</button>}
        {onDuplicateToDressingRoom && <button onClick={onDuplicateToDressingRoom} style={styles.secondaryBtn(false)}>Duplicate in Dressing Room</button>}
        <button onClick={onClose} style={styles.secondaryBtn(false)}>Close Large View</button>
      </div>
    </div>
  );
};

const OutfitCard = ({ outfit, allWardrobeItems, resetTrigger, theme, styles, onEdit, onExpand }) => {
  const [viewIndex, setViewState] = useState(0);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef(null);

  let rawItemIds = outfit.item_ids;
  if (typeof rawItemIds === 'string') {
    try { rawItemIds = JSON.parse(rawItemIds); } catch (e) { rawItemIds = []; }
  }
  const itemIdsArray = Array.isArray(rawItemIds) ? rawItemIds : [];

  const items = itemIdsArray
    .map(id => allWardrobeItems.find(i => String(i.id) === String(id)))
    .filter(Boolean);

  const layerOrder = ['coats', 'tops', 'bottoms', 'shoes', 'bags'];
  const orderedItems = layerOrder
    .map(layer => items.find(i => i.layer === layer))
    .filter(Boolean);

  if (outfit.image_url) {
    orderedItems.unshift({
      id: 'tryon', name: 'AI Virtual Try-On', image: outfit.image_url, layer: 'try-on'
    });
  }

  const totalItems = orderedItems.length;

  useEffect(() => {
    setViewState(0);
  }, [resetTrigger]);

  const handleTouchStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    touchStartPos.current = { x: clientX, y: clientY };

    longPressTimer.current = setTimeout(() => {
      onExpand({ outfit, items: orderedItems, title: outfit.name || 'Saved Outfit' });
      longPressTimer.current = null;
    }, 500); 
  };

  const handleTouchMove = (e) => {
    if (!longPressTimer.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - touchStartPos.current.x);
    const dy = Math.abs(clientY - touchStartPos.current.y);

    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const dx = touchStartPos.current.x - clientX;
      
      if (dx > 40 && totalItems > 1) {
        setViewState(prev => (prev + 1) % totalItems);
      } else if (dx < -40 && totalItems > 1) {
        setViewState(prev => (prev - 1 + totalItems) % totalItems);
      } else if (Math.abs(dx) < 10) {
        if (totalItems > 1) {
          setViewState(prev => (prev + 1) % totalItems);
        }
      }
    }
  };

  const currentItem = totalItems > 0 ? orderedItems[viewIndex % totalItems] : null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => { if(longPressTimer.current){ clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
      style={{
        backgroundColor: theme.card,
        borderRadius: '12px',
        border: `1px solid ${theme.text}20`,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        aspectRatio: '3/4',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      <button 
        onMouseDown={(e) => e.stopPropagation()} 
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onEdit(outfit); }} 
        style={{ ...styles.editCardBtn, top: '8px', right: '8px' }} 
        title="Edit Outfit Metadata"
      >
        <EditIcon />
      </button>

      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', marginTop: '14px' }}>
        {currentItem ? (
          <img
            src={currentItem.image}
            alt={currentItem.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <div style={{ opacity: 0.5, fontSize: '12px' }}>No items found</div>
        )}
      </div>
      
      <div style={{ width: '100%', textAlign: 'center', marginTop: '8px' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {outfit.name || 'Saved Outfit'}
        </p>
        {currentItem && (
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {LAYER_LABELS[currentItem.layer] || 'Item'}: {currentItem.name}
          </p>
        )}
        {totalItems > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '6px', padding: '4px 0' }}>
            {Array.from({ length: totalItems }).map((_, i) => (
              <div key={i} style={{ height: '6px', width: '6px', borderRadius: '50%', backgroundColor: i === viewIndex ? theme.accent : `${theme.text}40` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetadataEditorModal = ({ item, theme, styles, onSave, onClose, onDelete }) => {
  const [edited, setEdited] = useState({ ...item });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleChip = (category, val) => {
    setEdited(prev => {
      const arr = prev[category] || [];
      const exists = arr.includes(val);
      return { ...prev, [category]: exists ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={{...styles.modalBox, display: 'flex', flexDirection: 'column'}}>
         <div style={styles.modalTopRow}>
           <h3 style={styles.modalHeading}>Edit {item.name}</h3>
           <button onClick={onClose} style={styles.modalClose}><CloseIcon /></button>
         </div>
         
         <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }} className="hide-scrollbar">
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>Item Name</label>
            <input style={styles.inputField} value={edited.name || ''} onChange={e => setEdited({ ...edited, name: e.target.value })} />

            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>Layer</label>
            <select style={styles.selectField} value={edited.layer || ''} onChange={e => setEdited({ ...edited, layer: e.target.value })}>
              {LAYERS.map(l => <option key={l} value={l}>{LAYER_LABELS[l]}</option>)}
            </select>

            {Object.entries(FILTER_OPTIONS).map(([category, options]) => (
              <div key={category} style={{ marginBottom: '16px' }}>
                <p style={styles.paletteTitle}>{capitalize(category)}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {options.map(opt => (
                    <button key={opt} onClick={() => toggleChip(category, opt)} style={styles.filterChip(edited[category]?.includes(opt))}>
                      {capitalize(opt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
         </div>
         
         <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${theme.text}20` }}>
           {confirmDelete ? (
             <div style={{ padding: '12px', border: `1px solid #d32f2f`, borderRadius: '8px', backgroundColor: alpha('#d32f2f', '10') }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 'bold' }}>Are you sure you want to remove this item from the dressing room entirely?</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
                  <button onClick={() => onDelete(edited)} style={{...styles.confirmBtn, backgroundColor: '#d32f2f', color: '#fff'}}>Yes, Delete</button>
                </div>
             </div>
           ) : (
             <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={() => setConfirmDelete(true)} style={{...styles.cancelBtn, flex: '0.4', color: '#d32f2f', borderColor: '#d32f2f'}}>Delete</button>
               <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
               <button onClick={() => onSave(edited)} style={styles.confirmBtn}>Save</button>
             </div>
           )}
         </div>
      </div>
    </div>
  );
};

const OutfitMetadataEditorModal = ({ outfit, theme, styles, onSave, onClose, onDelete }) => {
  const [edited, setEdited] = useState({ 
    ...outfit, 
    metadata: outfit.metadata || { colors: [], occasion: [], weather: [], temperature: [] } 
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleChip = (category, val) => {
    setEdited(prev => {
      const meta = { ...prev.metadata };
      const arr = meta[category] || [];
      const exists = arr.includes(val);
      meta[category] = exists ? arr.filter(x => x !== val) : [...arr, val];
      return { ...prev, metadata: meta };
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={{...styles.modalBox, display: 'flex', flexDirection: 'column'}}>
         <div style={styles.modalTopRow}>
           <h3 style={styles.modalHeading}>Edit Outfit Details</h3>
           <button onClick={onClose} style={styles.modalClose}><CloseIcon /></button>
         </div>
         
         <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }} className="hide-scrollbar">
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>Outfit Name</label>
            <input style={styles.inputField} value={edited.name || ''} onChange={e => setEdited({ ...edited, name: e.target.value })} />

            {Object.entries(FILTER_OPTIONS).map(([category, options]) => (
              <div key={category} style={{ marginBottom: '16px' }}>
                <p style={styles.paletteTitle}>{capitalize(category)}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {options.map(opt => (
                    <button key={opt} onClick={() => toggleChip(category, opt)} style={styles.filterChip(edited.metadata[category]?.includes(opt))}>
                      {capitalize(opt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
         </div>
         
         <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${theme.text}20` }}>
           {confirmDelete ? (
             <div style={{ padding: '12px', border: `1px solid #d32f2f`, borderRadius: '8px', backgroundColor: alpha('#d32f2f', '10') }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 'bold' }}>Are you sure you want to remove this outfit from your closet?</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
                  <button onClick={() => onDelete(edited)} style={{...styles.confirmBtn, backgroundColor: '#d32f2f', color: '#fff'}}>Yes, Delete</button>
                </div>
             </div>
           ) : (
             <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={() => setConfirmDelete(true)} style={{...styles.cancelBtn, flex: '0.4', color: '#d32f2f', borderColor: '#d32f2f'}}>Delete</button>
               <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
               <button onClick={() => onSave(edited)} style={styles.confirmBtn}>Save</button>
             </div>
           )}
         </div>
      </div>
    </div>
  );
};

export default function App() {
  const [themeId, setThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem('wardrobe_app_theme');
      if (saved && THEMES.some(t => t.id === saved)) return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [showPalette, setShowPalette] = useState(false);
  const activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const styles = getThemeStyles(activeTheme);

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return localStorage.getItem('wardrobe_auth') === 'true'; } catch (e) { return false; }
  });
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (!document.getElementById('pwa-manifest')) {
      const manifest = {
        name: "Izzy's Wardrobe",
        short_name: "Wardrobe",
        start_url: ".",
        display: "standalone",
        background_color: "#F5F3EE",
        theme_color: "#2F4A3A",
        icons: [
          { src: "https://placehold.co/192x192/2F4A3A/FFF?text=W", sizes: "192x192", type: "image/png" },
          { src: "https://placehold.co/512x512/2F4A3A/FFF?text=W", sizes: "512x512", type: "image/png" }
        ]
      };
      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], { type: 'application/json' });
      const manifestURL = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.id = 'pwa-manifest'; link.rel = 'manifest'; link.href = manifestURL;
      document.head.appendChild(link);

      const appleMeta = document.createElement('meta');
      appleMeta.name = 'apple-mobile-web-app-capable'; appleMeta.content = 'yes';
      document.head.appendChild(appleMeta);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('wardrobe');
  const [wardrobe, setWardrobe] = useState(() => INITIAL_WARDROBE.map(normalizeItem));
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [outfitFilterText, setOutfitFilterText] = useState('');
  
  const [activeFilters, setActiveFilters] = useState({ temperature: [], weather: [], colors: [], occasion: [] });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingOutfit, setEditingOutfit] = useState(null);
  const [editingOutfitId, setEditingOutfitId] = useState(null);
  const [showSaveOutfitModal, setShowSaveOutfitModal] = useState(false);
  const [newOutfitName, setNewOutfitName] = useState('');
  const [expandedOutfitData, setExpandedOutfitData] = useState(null);
  const [excludeTopFromTryOn, setExcludeTopFromTryOn] = useState(false); 

  const [selectedOutfit, setSelectedOutfit] = useState({
    coats: null, tops: null, bottoms: null, shoes: null, bags: null
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBodyUploadModal, setShowBodyUploadModal] = useState(false);
  
  const [userBodyPhoto, setUserBodyPhoto] = useState(() => {
    try {
      return localStorage.getItem('wardrobe_body_photo') || 'https://placehold.co/400x650/f4f4f4/333?text=Upload+Your+Photo+Above';
    } catch (e) {
      return 'https://placehold.co/400x650/f4f4f4/333?text=Upload+Your+Photo+Above';
    }
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [tryOnResult, setTryOnResult] = useState(null);
  const [pendingTryOnImage, setPendingTryOnImage] = useState(null);

  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isLongPressActive = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('wardrobe_app_theme', themeId); } catch (e) {}
  }, [themeId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSavedClothes();
      fetchSavedOutfits();
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'izzy123';
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      try { 
        localStorage.setItem('wardrobe_auth', 'true'); 
        localStorage.setItem('wardrobe_password', passwordInput);
      } catch (err) {}
    } else {
      alert('Incorrect password');
    }
  };

  const fetchSavedClothes = async () => {
    try {
      const response = await secureFetch('/api/supabase?action=getClothes');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API route returned non-JSON response');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch clothes');
      
      if (result.data && result.data.length > 0) {
        const normalizedData = result.data.map(normalizeItem);
        setWardrobe(prev => {
          const existingIds = new Set(normalizedData.map(i => i.id));
          const keptInitial = INITIAL_WARDROBE.map(normalizeItem).filter(i => !existingIds.has(i.id));
          return [...keptInitial, ...normalizedData];
        });
      }
    } catch (err) {
      console.warn("Error loading clothes (backend may still be syncing):", err.message);
    }
  };

  const fetchSavedOutfits = async () => {
    try {
      const response = await secureFetch('/api/supabase?action=getOutfits');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API route returned non-JSON response');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch outfits');

      if (result.data) {
        const cleanedData = result.data.map(outfit => {
          let itemIds = outfit.item_ids;
          if (typeof itemIds === 'string') {
            try { itemIds = JSON.parse(itemIds); } catch (e) { itemIds = []; }
          }
          if (!Array.isArray(itemIds)) itemIds = [];
          return { ...outfit, item_ids: itemIds };
        });
        setSavedOutfits(cleanedData);
      }
    } catch (err) {
      console.warn("Error fetching outfits (backend may still be syncing):", err.message);
    }
  };

  const handleSaveOutfit = async () => {
    const selectedItems = Object.values(selectedOutfit).filter(Boolean);
    if (selectedItems.length === 0 && !pendingTryOnImage) return;

    const aggregatedMetadata = {
      colors: [...new Set(selectedItems.flatMap(i => i.colors || []))],
      occasion: [...new Set(selectedItems.flatMap(i => i.occasion || []))],
      weather: [...new Set(selectedItems.flatMap(i => i.weather || []))],
      temperature: [...new Set(selectedItems.flatMap(i => i.temperature || []))]
    };

    try {
      setIsUploading(true);
      let tryOnBase64 = null;
      
      if (pendingTryOnImage) {
        setUploadStatus('Saving AI image to secure cloud...');
        const res = await fetch(pendingTryOnImage);
        const blob = await res.blob();
        tryOnBase64 = await blobToBase64(blob);
      }

      if (editingOutfitId) {
        setUploadStatus('Updating outfit in Closet...');
        const response = await secureFetch('/api/supabase', {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateOutfit',
            id: editingOutfitId,
            name: newOutfitName || "My Custom Outfit",
            item_ids: selectedItems.map(i => i.id),
            metadata: aggregatedMetadata,
            imageFile: tryOnBase64
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update outfit');

        setSavedOutfits(prev => prev.map(o => o.id === editingOutfitId ? { ...o, ...result.data } : o));
        setEditingOutfitId(null);
      } else {
        setUploadStatus('Saving to Closet...');
        const newOutfitId = `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const response = await secureFetch('/api/supabase', {
          method: 'POST',
          body: JSON.stringify({
            action: 'saveOutfit',
            id: newOutfitId,
            name: newOutfitName || "My Custom Outfit",
            item_ids: selectedItems.map(i => i.id),
            metadata: aggregatedMetadata,
            imageFile: tryOnBase64
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to save outfit');
        
        setSavedOutfits(prev => [...prev, result.data]);
      }

      setShowSaveOutfitModal(false);
      setNewOutfitName('');
      setPendingTryOnImage(null);
      setActiveTab('closet');
    } catch (err) {
      alert("Failed to save outfit: " + err.message);
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const itemMatchesFilters = (item) => {
    const { temperature, weather, colors, occasion } = activeFilters;
    if (temperature.length > 0 && !temperature.some(t => item.temperature?.includes(t))) return false;
    if (weather.length > 0 && !weather.some(w => item.weather?.includes(w))) return false;
    if (colors.length > 0 && !colors.some(c => item.colors?.map(col => col.toLowerCase()).includes(c.toLowerCase()))) return false;
    if (occasion.length > 0 && !occasion.some(o => item.occasion?.includes(o))) return false;
    return true;
  };

  const outfitMatchesFilters = (outfit) => {
    const { temperature, weather, colors, occasion } = activeFilters;
    const meta = outfit.metadata || {};
    if (temperature.length > 0 && !temperature.some(t => meta.temperature?.includes(t))) return false;
    if (weather.length > 0 && !weather.some(w => meta.weather?.includes(w))) return false;
    if (colors.length > 0 && !colors.some(c => meta.colors?.map(col => col.toLowerCase()).includes(c.toLowerCase()))) return false;
    if (occasion.length > 0 && !occasion.some(o => meta.occasion?.includes(o))) return false;
    return true;
  };

  const getFilteredItems = (layerKey) => {
    const items = wardrobe.filter(item => item.layer === layerKey && itemMatchesFilters(item));
    return [{ id: `none-${layerKey}`, name: 'None', layer: layerKey, isNone: true }, ...items];
  };

  const toggleFilterChip = (category, value) => {
    setActiveFilters(prev => {
      const currentArr = prev[category] || [];
      const exists = currentArr.includes(value);
      const updated = exists ? currentArr.filter(v => v !== value) : [...currentArr, value];
      return { ...prev, [category]: updated };
    });
  };

  const clearAllFilters = () => setActiveFilters({ temperature: [], weather: [], colors: [], occasion: [] });

  const activeFilterCount = Object.values(activeFilters).reduce((acc, arr) => acc + arr.length, 0);

  const handleSelectItem = (layerKey, item) => {
    if (isLongPressActive.current) return;
    setSelectedOutfit(prev => ({ ...prev, [layerKey]: item.isNone ? null : item }));
  };

  const handleTouchStart = (item, e) => {
    if (item.isNone) return;
    isLongPressActive.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    touchStartPos.current = { x: clientX, y: clientY };

    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      setEditingItem(item);
    }, 450); 
  };

  const handleTouchMove = (e) => {
    if (!longPressTimer.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - touchStartPos.current.x);
    const dy = Math.abs(clientY - touchStartPos.current.y);

    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTimeout(() => { isLongPressActive.current = false; }, 200);
  };

  const generateSmartOutfit = () => {
    let pool = wardrobe.filter(itemMatchesFilters);
    if (pool.length === 0) pool = wardrobe; 

    const tops = pool.filter(i => i.layer === 'tops');
    const bottoms = pool.filter(i => i.layer === 'bottoms');
    const coats = pool.filter(i => i.layer === 'coats');
    
    const top = tops.length > 0 ? tops[Math.floor(Math.random() * tops.length)] : null;
    
    let validBottoms = bottoms;
    if (top && top.colors) {
      validBottoms = bottoms.filter(b => areColorsCompatible(top.colors, b.colors));
    }
    if (validBottoms.length === 0) validBottoms = bottoms;
    const bottom = validBottoms.length > 0 ? validBottoms[Math.floor(Math.random() * validBottoms.length)] : null;

    let validCoats = coats;
    if (activeFilters.temperature.includes('hot')) validCoats = [];
    const coat = validCoats.length > 0 && Math.random() > 0.4 ? validCoats[Math.floor(Math.random() * validCoats.length)] : null;

    setSelectedOutfit({
      tops: top, bottoms: bottom, coats: coat,
      shoes: pool.find(i => i.layer === 'shoes') || null,
      bags: pool.find(i => i.layer === 'bags') || null
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowUploadModal(false); 
    setIsUploading(true);
    setUploadStatus('Processing item image...');
    
    try {
      let processedFile = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        setUploadStatus('Converting HEIC format...');
        const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
        processedFile = new File([converted], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      }
      
      setUploadStatus('Removing background magically...');
      const noBgBlob = await imglyRemoveBackground(processedFile);
      
      setUploadStatus('Generating AI tags via secure server...');
      const base64Img = await resizeImageForAI(noBgBlob, 512);
      
      const geminiRes = await secureFetch('/api/gemini', {
        method: 'POST',
        body: JSON.stringify({ base64Img })
      });

      const metadata = await geminiRes.json();
      if (!geminiRes.ok) throw new Error(metadata.error || 'AI tagging failed.');

      setUploadStatus('Uploading to secure cloud...');
      const imageBase64 = await blobToBase64(noBgBlob);
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

      const supabaseRes = await secureFetch('/api/supabase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadClothing',
          item: { id: itemId, ...metadata },
          fileName,
          imageFile: imageBase64
        })
      });

      const supabaseResult = await supabaseRes.json();
      if (!supabaseRes.ok) throw new Error(supabaseResult.error || 'Storage upload failed.');

      const normalizedItem = normalizeItem(supabaseResult.data);
      setWardrobe(prev => [...prev, normalizedItem]);
      setSelectedOutfit(prev => ({ ...prev, [normalizedItem.layer]: normalizedItem }));
      
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleBodyPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setShowBodyUploadModal(false); 
    setIsUploading(true);
    setUploadStatus('Processing body photo...');
    try {
      let processedFile = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
        processedFile = new File([converted], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      }
      
      const standardBlob = await convertToStandardImageBlob(processedFile);
      const base64Data = await blobToBase64(standardBlob);
      setUserBodyPhoto(base64Data);
      try {
        localStorage.setItem('wardrobe_body_photo', base64Data);
      } catch (e) {}
    } catch (err) {
      alert("Failed to process photo.");
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const saveUpdatedItemMetadata = async (updatedItem) => {
    const normalized = normalizeItem(updatedItem);
    setWardrobe(prev => prev.map(item => item.id === normalized.id ? normalized : item));
    
    if (selectedOutfit[normalized.layer]?.id === normalized.id) {
      setSelectedOutfit(prev => ({ ...prev, [normalized.layer]: normalized }));
    }

    try {
      await secureFetch('/api/supabase', {
        method: 'POST',
        body: JSON.stringify({ action: 'updateCloth', item: normalized })
      });
    } catch (err) {
      console.warn("Supabase update skipped/failed:", err);
    }
    setEditingItem(null);
  };

  const deleteUpdatedItem = async (itemToDelete) => {
    setWardrobe(prev => prev.filter(item => item.id !== itemToDelete.id));
    if (selectedOutfit[itemToDelete.layer]?.id === itemToDelete.id) {
      setSelectedOutfit(prev => ({ ...prev, [itemToDelete.layer]: null }));
    }

    try {
      await secureFetch('/api/supabase', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteCloth', id: itemToDelete.id })
      });
    } catch (err) {
      console.warn("Supabase delete failed:", err);
    }
    setEditingItem(null);
  };

  const saveUpdatedOutfitMetadata = async (updatedOutfit) => {
    setSavedOutfits(prev => prev.map(o => o.id === updatedOutfit.id ? updatedOutfit : o));
    
    try {
      await secureFetch('/api/supabase', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'updateOutfitMetadata', 
          id: updatedOutfit.id,
          name: updatedOutfit.name,
          metadata: updatedOutfit.metadata
        })
      });
    } catch (err) {
      console.warn("Supabase outfit update failed:", err);
    }
    setEditingOutfit(null);
  };

  const deleteSavedOutfit = async (outfitToDelete) => {
    setSavedOutfits(prev => prev.filter(o => o.id !== outfitToDelete.id));
    try {
      await secureFetch('/api/supabase', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteOutfit', id: outfitToDelete.id })
      });
    } catch (err) {
      console.warn("Supabase outfit delete failed:", err);
    }
    setEditingOutfit(null);
  };

  const executeVirtualTryOn = async () => {
    setShowConfirmModal(false);
    setIsGenerating(true);

    try {
      const activeGarments = Object.entries(selectedOutfit)
        .filter(([layer, item]) => {
          if (item === null) return false;
          if (layer === 'tops' && selectedOutfit.coats && excludeTopFromTryOn) return false;
          return true;
        })
        .map(([layer, item]) => ({ layer, name: item.name, imageUrl: item.image, id: item.id }));

      if (activeGarments.length === 0) throw new Error("Select at least one garment.");

      const tryOnLayersOrder = ['bottoms', 'tops', 'coats'];
      const garmentsToProcess = activeGarments
        .filter(g => tryOnLayersOrder.includes(g.layer))
        .sort((a, b) => tryOnLayersOrder.indexOf(a.layer) - tryOnLayersOrder.indexOf(b.layer));

      if (garmentsToProcess.length === 0) throw new Error("No compatible apparel layers selected for Try-On.");

      let currentPhoto = userBodyPhoto;
      const stepHistory = [];

      for (let i = 0; i < garmentsToProcess.length; i++) {
        const garment = garmentsToProcess[i];
        setUploadStatus(`Step ${i + 1}/${garmentsToProcess.length}: Fitting ${garment.name}...`);
        
        const response = await secureFetch('/api/hf', {
          method: 'POST',
          body: JSON.stringify({
            personImage: currentPhoto,
            garmentImage: garment.imageUrl
          })
        });

        const resultData = await response.json();
        if (!response.ok) throw new Error(resultData.error || `Virtual try-on failed for ${garment.name}`);

        currentPhoto = resultData.resultUrl;
        stepHistory.push({ stepNumber: i + 1, garmentName: garment.name, resultPhoto: currentPhoto });
      }

      const finalTryOnPhoto = stepHistory[stepHistory.length - 1]?.resultPhoto;
      setPendingTryOnImage(finalTryOnPhoto);
      setTryOnResult({ steps: stepHistory, summary: `Multi-step AI fit complete • ${activeGarments.map(i => i.name).join(' + ')}`, isFallback: false });

    } catch (err) {
      setTryOnResult({ isFallback: true, summary: "API queue busy or failed — " + err.message });
    } finally {
      setIsGenerating(false);
      setUploadStatus('');
    }
  };

  const getActiveDressingRoomOutfitItems = () => {
    const layerOrder = ['coats', 'tops', 'bottoms', 'shoes', 'bags'];
    const items = layerOrder.map(l => selectedOutfit[l]).filter(Boolean);

    const latestAiImage = pendingTryOnImage || (tryOnResult?.steps && tryOnResult.steps.length > 0 ? tryOnResult.steps[tryOnResult.steps.length - 1].resultPhoto : null);

    if (latestAiImage) {
      items.push({
        id: 'tryon_dressing_room',
        name: 'AI Virtual Try-On Look',
        image: latestAiImage,
        layer: 'try-on'
      });
    }

    return items;
  };

  const activeDressingRoomItems = getActiveDressingRoomOutfitItems();

  const loadOutfitToDressingRoom = (items, sourceOutfit = null) => {
    const newSelected = { coats: null, tops: null, bottoms: null, shoes: null, bags: null };
    items.forEach(item => {
      if (item.layer && newSelected.hasOwnProperty(item.layer)) {
        newSelected[item.layer] = item;
      }
    });
    setSelectedOutfit(newSelected);
    if (sourceOutfit) {
      setEditingOutfitId(sourceOutfit.id);
      setNewOutfitName(sourceOutfit.name || '');
    } else {
      setEditingOutfitId(null);
      setNewOutfitName('');
    }
    setExpandedOutfitData(null);
    setActiveTab('wardrobe');
  };

  const duplicateOutfitToDressingRoom = (items, sourceOutfit = null) => {
    const newSelected = { coats: null, tops: null, bottoms: null, shoes: null, bags: null };
    items.forEach(item => {
      if (item.layer && newSelected.hasOwnProperty(item.layer)) {
        newSelected[item.layer] = item;
      }
    });
    setSelectedOutfit(newSelected);
    setEditingOutfitId(null); 
    setNewOutfitName(sourceOutfit && sourceOutfit.name ? `${sourceOutfit.name} (Copy)` : '');
    setExpandedOutfitData(null);
    setActiveTab('wardrobe');
  };

  const renderFilterBar = () => (
    <div style={styles.filterRow}>
      <button onClick={() => setShowFilterModal(true)} style={styles.filterTab(activeFilterCount > 0)}>
        <FilterIcon /> Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
      </button>
      {activeFilterCount > 0 && <button onClick={clearAllFilters} style={styles.clearBtn}>Clear all</button>}
      <div style={{ flex: 1 }} />
      {activeTab === 'wardrobe' && (
        <button onClick={generateSmartOutfit} style={styles.magicBtn} title="Smart Outfit Generator">
          <SparkIcon /> Auto Outfit
        </button>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div style={{ ...styles.appContainer, justifyContent: 'center', alignItems: 'center' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,620&family=Archivo:wght@400;500;600;650&display=swap');
        `}</style>
        <div style={{ ...styles.modalBox, width: '100%', maxWidth: '320px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{ ...styles.wordmark, fontSize: '28px', marginBottom: '8px' }}>Izzy's Wardrobe</h2>
          <p style={{ marginBottom: '24px', opacity: 0.8, fontSize: '14px' }}>Please enter your password to access your closet.</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              style={{ ...styles.inputField, marginBottom: 0 }} 
              placeholder="Password" 
              required
            />
            <button type="submit" style={styles.primaryBtn}>Unlock Closet</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,620&family=Archivo:wght@400;500;600;650&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <div className="wardrobe-app">
        <header style={styles.header}>
          <h1 style={styles.wordmark}>Izzy's Wardrobe</h1>
          <div style={styles.headerRight}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowPalette(v => !v)} style={styles.iconBtn} aria-label="Theme"><PaletteIcon /></button>
              {showPalette && (
                <>
                  <div style={styles.paletteScrim} onClick={() => setShowPalette(false)} />
                  <div style={styles.palettePopover}>
                    <p style={styles.paletteTitle}>App Theme</p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: '156px' }}>
                      {THEMES.map(t => (
                        <button key={t.id} onClick={() => { setThemeId(t.id); setShowPalette(false); }} style={styles.swatch(t.bg, t.id === themeId, t.text)} title={t.label}>
                          {t.id === themeId && <CheckIcon />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowBodyUploadModal(true)} style={styles.iconBtn} aria-label="Upload photo"><CameraIcon /></button>
            <button onClick={() => setShowUploadModal(true)} style={styles.addBtn}>Add item</button>
          </div>
        </header>

        <div style={styles.tabsContainer}>
          <button onClick={() => setActiveTab('wardrobe')} style={styles.tabBtn(activeTab === 'wardrobe')}>Dressing Room</button>
          <button onClick={() => setActiveTab('closet')} style={styles.tabBtn(activeTab === 'closet')}>My Closet</button>
        </div>

        {activeTab === 'wardrobe' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {renderFilterBar()}

            {activeDressingRoomItems.length > 0 && (
              <div 
                onClick={() => setExpandedOutfitData({ items: activeDressingRoomItems, title: "Dressing Room Outfit" })}
                style={{
                  backgroundColor: activeTheme.card,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  border: `1px dashed ${activeTheme.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', position: 'relative', width: '60px', height: '40px', alignItems: 'center' }}>
                    {activeDressingRoomItems.slice(0, 3).map((item, i) => (
                      <img 
                        key={item.id || i} 
                        src={item.image} 
                        alt="" 
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          position: 'absolute',
                          left: `${i * 14}px`,
                          border: `2px solid ${activeTheme.card}`,
                          zIndex: i,
                          backgroundColor: '#fff'
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Selected Outfit ({activeDressingRoomItems.length} items)</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Tap to expand into large full-screen view</div>
                  </div>
                </div>
                <div style={{ backgroundColor: activeTheme.accent, color: activeTheme.bg, padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ExpandIcon /> Enlarge
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0 10px', flex: 1 }}>
              {LAYERS.map(layerKey => {
                if (layerKey === 'try-on') return null;
                const items = getFilteredItems(layerKey);
                return (
                  <div key={layerKey} style={styles.layerSection}>
                    <div style={styles.layerLabelRow}>
                      <span style={styles.layerLabel}>{LAYER_LABELS[layerKey]}</span>
                      <span style={styles.itemCount}>{items.length - 1} items</span>
                    </div>
                    
                    <div id={`carousel-${layerKey}`} style={styles.carouselTrack} className="hide-scrollbar">
                      {items.map(item => {
                        const isSelected = item.isNone ? selectedOutfit[layerKey] === null : selectedOutfit[layerKey]?.id === item.id;
                        return (
                          <div 
                            key={item.id} 
                            id={`card-${layerKey}-${item.id}`}
                            onClick={() => handleSelectItem(layerKey, item)}
                            onMouseDown={(e) => handleTouchStart(item, e)}
                            onMouseUp={handleTouchEnd}
                            onMouseMove={handleTouchMove}
                            onTouchStart={(e) => handleTouchStart(item, e)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                            style={styles.itemCard(isSelected)}
                          >
                            {item.isNone ? (
                              <div style={styles.noneCard(isSelected)}>None</div>
                            ) : (
                              <>
                                <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                                <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); }} style={styles.editCardBtn} title="Edit Metadata">
                                  <EditIcon />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.actionRow}>
              <button 
                onClick={() => setShowSaveOutfitModal(true)} 
                disabled={Object.values(selectedOutfit).filter(Boolean).length === 0}
                style={styles.secondaryBtn(Object.values(selectedOutfit).filter(Boolean).length === 0)}
              >
                <SaveIcon /> Save
              </button>
              <button onClick={() => setShowConfirmModal(true)} style={styles.primaryBtn}>
                <SparkIcon /> Try on outfit
              </button>
            </div>
          </div>
        )}

        {activeTab === 'closet' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {renderFilterBar()}
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Search saved outfits..." 
                value={outfitFilterText}
                onChange={e => setOutfitFilterText(e.target.value)}
                style={styles.inputField}
              />
            </div>

            {savedOutfits.filter(outfit => {
              const matchesText = (outfit.name || '').toLowerCase().includes(outfitFilterText.toLowerCase());
              const matchesFilter = outfitMatchesFilters(outfit);
              return matchesText && matchesFilter;
            }).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.6 }}>
                <p>No saved outfits match your filters.</p>
              </div>
            ) : (
              <div style={styles.outfitGrid}>
                {savedOutfits.filter(outfit => {
                  const matchesText = (outfit.name || '').toLowerCase().includes(outfitFilterText.toLowerCase());
                  const matchesFilter = outfitMatchesFilters(outfit);
                  return matchesText && matchesFilter;
                }).map(outfit => (
                  <OutfitCard 
                    key={outfit.id} 
                    outfit={outfit} 
                    allWardrobeItems={wardrobe}
                    resetTrigger={activeTab}
                    theme={activeTheme}
                    styles={styles}
                    onEdit={o => setEditingOutfit(o)}
                    onExpand={data => setExpandedOutfitData(data)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTopRow}>
              <h3 style={styles.modalHeading}>Add Clothing Item</h3>
              <button onClick={() => setShowUploadModal(false)} style={styles.modalClose}><CloseIcon /></button>
            </div>
            <p style={styles.modalBody}>Upload a photo of your clothing item. AI will automatically remove the background and tag it!</p>
            <label style={styles.uploadArea}>
              <UploadIcon />
              <span>Choose Photo or Take Picture</span>
              <input type="file" accept="image/*,.heic" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {showBodyUploadModal && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTopRow}>
              <h3 style={styles.modalHeading}>Upload Your Full-Body Photo</h3>
              <button onClick={() => setShowBodyUploadModal(false)} style={styles.modalClose}><CloseIcon /></button>
            </div>
            <p style={styles.modalBody}>Upload a clear full-body photo of yourself to use for AI Virtual Try-On.</p>
            <label style={styles.uploadArea}>
              <UploadIcon />
              <span>Choose Body Photo</span>
              <input type="file" accept="image/*,.heic" onChange={handleBodyPhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div style={styles.overlay}>
          <div style={{...styles.modalBox, display: 'flex', flexDirection: 'column'}}>
            <div style={styles.modalTopRow}>
              <h3 style={styles.modalHeading}>Filter Wardrobe</h3>
              <button onClick={() => setShowFilterModal(false)} style={styles.modalClose}><CloseIcon /></button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }} className="hide-scrollbar">
              {Object.entries(FILTER_OPTIONS).map(([category, options]) => (
                <div key={category} style={{ marginBottom: '16px' }}>
                  <p style={styles.paletteTitle}>{capitalize(category)}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {options.map(opt => (
                      <button key={opt} onClick={() => toggleFilterChip(category, opt)} style={styles.filterChip(activeFilters[category]?.includes(opt))}>
                        {capitalize(opt)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={clearAllFilters} style={styles.cancelBtn}>Clear All</button>
              <button onClick={() => setShowFilterModal(false)} style={styles.confirmBtn}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {showSaveOutfitModal && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTopRow}>
              <h3 style={styles.modalHeading}>{editingOutfitId ? 'Update Saved Outfit' : 'Save Outfit'}</h3>
              <button onClick={() => setShowSaveOutfitModal(false)} style={styles.modalClose}><CloseIcon /></button>
            </div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>Outfit Name</label>
            <input 
              style={styles.inputField} 
              value={newOutfitName} 
              onChange={e => setNewOutfitName(e.target.value)} 
              placeholder="e.g. Casual Friday Look" 
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowSaveOutfitModal(false)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSaveOutfit} style={styles.confirmBtn}>Save to Closet</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTopRow}>
              <h3 style={styles.modalHeading}>AI Virtual Try-On</h3>
              <button onClick={() => setShowConfirmModal(false)} style={styles.modalClose}><CloseIcon /></button>
            </div>
            <p style={styles.modalBody}>Generate a realistic AI try-on image of this outfit on your body photo?</p>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="excludeTop" 
                checked={excludeTopFromTryOn} 
                onChange={e => setExcludeTopFromTryOn(e.target.checked)} 
              />
              <label htmlFor="excludeTop" style={{ fontSize: '13px', cursor: 'pointer' }}>Layer coat over top (skip top garment try-on step)</label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirmModal(false)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={executeVirtualTryOn} style={styles.confirmBtn}>Generate Try-On</button>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modalBox, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: '40px', height: '40px', border: `4px solid ${activeTheme.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 8px' }}>Creating Your Look...</h3>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>{uploadStatus || 'Fitting garments onto your photo...'}</p>
          </div>
        </div>
      )}

      {editingItem && (
        <MetadataEditorModal 
          item={editingItem} 
          theme={activeTheme} 
          styles={styles} 
          onClose={() => setEditingItem(null)} 
          onSave={saveUpdatedItemMetadata}
          onDelete={deleteUpdatedItem}
        />
      )}

      {editingOutfit && (
        <OutfitMetadataEditorModal 
          outfit={editingOutfit} 
          theme={activeTheme} 
          styles={styles} 
          onClose={() => setEditingOutfit(null)} 
          onSave={saveUpdatedOutfitMetadata}
          onDelete={deleteSavedOutfit}
        />
      )}

      {expandedOutfitData && (
        <ExpandedOutfitModal 
          items={expandedOutfitData.items} 
          outfitTitle={expandedOutfitData.title}
          theme={activeTheme}
          styles={styles}
          onClose={() => setExpandedOutfitData(null)}
          onLoadToDressingRoom={() => loadOutfitToDressingRoom(expandedOutfitData.items, expandedOutfitData.outfit)}
          onDuplicateToDressingRoom={() => duplicateOutfitToDressingRoom(expandedOutfitData.items, expandedOutfitData.outfit)}
        />
      )}
    </div>
  );
}