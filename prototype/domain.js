(function (root) {
  'use strict';
  const sports = ['Football', 'Cricket', 'Badminton'];
  const time = value => /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60;
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const starts = item => new Date(item.date + 'T' + item.time + ':00+05:30').getTime();
  const deadline = item => starts(item) - 60 * 60 * 1000;
  const closed = item => ['cancelled', 'expired', 'completed'].includes(item.status);
  const key = value => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
  function text(value, label, max) {
    const clean = String(value || '').trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > max) throw new Error(label + ' must contain 1–' + max + ' characters.');
    return clean;
  }
  function validateSlot(input, state, now = Date.now()) {
    const venue = text(input.venue, 'Venue', 80);
    if (!sports.includes(input.sport)) throw new Error('Choose a supported sport.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !time(input.time) || !Number.isFinite(starts(input))) throw new Error('Choose a valid date and time.');
    if (new Date(input.date + 'T12:00:00Z').toISOString().slice(0, 10) !== input.date) throw new Error('Choose a valid calendar date.');
    if (deadline(input) <= now) throw new Error('Choose a slot more than one hour in the future.');
    const price = Number(input.price);
    if (!Number.isInteger(price) || price < 100 || price > 50000) throw new Error('Enter a whole-rupee price between ₹100 and ₹50,000.');
    const end = starts(input) + 3600000;
    const overlap = other => key(other.venue) === key(venue) && starts(other) < end && starts(input) < starts(other) + 3600000;
    if (state.slots.some(overlap) || state.matches.some(m => !closed(m) && overlap(m))) throw new Error('This playing area already has an overlapping slot or match. Use a separate name for another court.');
    return { ...input, venue, price, blocked: false };
  }
  function available(slot, state, now = Date.now()) {
    return !slot.blocked && deadline(slot) > now && !state.matches.some(m => m.slot === slot.id && !closed(m));
  }
  function create(input, state, now = Date.now()) {
    const title = text(input.title, 'Match name', 70);
    const total = Number(input.total);
    if (!sports.includes(input.sport)) throw new Error('Choose a supported sport.');
    if (!Number.isInteger(total) || total < 2 || total > 30) throw new Error('Choose 2–30 whole player places.');
    if (['Football', 'Cricket'].includes(input.sport) && total % 2) throw new Error('Choose an even player count for two equal teams.');
    if (input.sport === 'Badminton' && ![2, 4].includes(total)) throw new Error('Badminton supports singles (2) or doubles (4).');
    const slot = state.slots.find(s => s.id === Number(input.slot));
    if (!slot || !available(slot, state, now)) throw new Error('This slot is unavailable or its joining deadline has passed.');
    if (slot.sport !== input.sport) throw new Error('Choose a slot for the selected sport.');
    if (Math.round(slot.price * 100) % total) throw new Error('The price must divide equally to the paise. Choose another player count.');
    return { id: input.id, title, sport: input.sport, venue: slot.venue, date: slot.date, time: slot.time, total, joined: 0, price: slot.price / total, mine: false, host: true, status: 'open', slot: slot.id };
  }
  function expire(state, now = Date.now()) {
    let count = 0;
    for (const match of state.matches) {
      if (closed(match)) continue;
      if (match.joined < match.total && deadline(match) <= now) {
        match.status = 'expired'; match.wasMine = match.wasMine || match.mine; match.mine = false; match.joined = 0;
        state.payments.filter(p => p.match === match.id && p.status === 'Paid').forEach(p => { p.status = 'Refunded'; p.reason = 'Joining deadline expired'; });
        count++;
      } else if (match.joined === match.total && starts(match) + 3600000 <= now) match.status = 'completed';
    }
    return count;
  }
  function join(state, id, now = Date.now()) {
    const match = state.matches.find(m => m.id === id);
    if (!match || closed(match) || deadline(match) <= now || match.mine || match.joined >= match.total) throw new Error('This place is no longer available. Refresh the match list.');
    if (state.matches.some(m => m.mine && !closed(m) && Math.abs(starts(m) - starts(match)) < 3600000)) throw new Error('You have already joined a match that overlaps this time.');
    match.mine = true; match.wasMine = true; match.joined++;
    return match;
  }
  function withdraw(state, id, now = Date.now()) {
    const match = state.matches.find(m => m.id === id);
    if (!match || !match.mine || closed(match) || starts(match) <= now) throw new Error('This match can no longer be withdrawn from.');
    match.mine = false; match.wasMine = true; match.joined--;
    state.payments.filter(p => p.match === id && p.status === 'Paid').forEach(p => { p.status = 'Refunded'; p.reason = 'Player withdrawal'; });
    expire(state, now);
  }
  function cancel(state, id) {
    const match = state.matches.find(m => m.id === id);
    if (!match || closed(match)) throw new Error('This match is already closed.');
    match.wasMine = match.wasMine || match.mine; match.mine = false; match.joined = 0; match.status = 'cancelled';
    state.payments.filter(p => p.match === id && p.status === 'Paid').forEach(p => { p.status = 'Refunded'; p.reason = 'Match cancelled'; });
  }
  function normalize(value) {
    if (!value || typeof value !== 'object' || !value.profile || !['matches','payments','slots','owners','activity'].every(k => Array.isArray(value[k]))) throw new Error('Saved demo data is incomplete.');
    text(value.profile.name, 'Name', 40); text(value.profile.area, 'Area', 60);
    if (!sports.includes(value.profile.sport)) throw new Error('Invalid saved sport.');
    for (const m of value.matches) {
      if (!Number.isFinite(m.id) || !sports.includes(m.sport) || !Number.isInteger(m.total) || m.total < 2 || !Number.isInteger(m.joined) || m.joined < 0 || m.joined > m.total || !Number.isFinite(m.price) || m.price <= 0 || !Number.isFinite(starts(m))) throw new Error('Saved match data is invalid.');
      text(m.title, 'Title', 70); text(m.venue, 'Venue', 80);
      m.wasMine = Boolean(m.wasMine || m.mine || value.payments.some(p => p.match === m.id));
      if (m.status === 'cancelled') { m.mine = false; m.joined = 0; }
    }
    for (const s of value.slots) {
      if (!Number.isFinite(s.id) || !Number.isFinite(s.price) || s.price <= 0 || !Number.isFinite(starts(s))) throw new Error('Saved slot data is invalid.');
      text(s.venue, 'Venue', 80);
      s.sport = s.sport || (s.venue.toLowerCase().includes('boundary') ? 'Cricket' : s.venue.toLowerCase().includes('court') ? 'Badminton' : 'Football');
    }
    for (const p of value.payments) if (!Number.isFinite(p.amount) || !['Paid','Refunded'].includes(p.status)) throw new Error('Saved payment data is invalid.');
    value.version = 2;
    return value;
  }
  const api = { sports, text, starts, deadline, closed, available, create, validateSlot, join, withdraw, cancel, expire, normalize, endTime: t => { const n = (minutes(t) + 60) % 1440; return String(Math.floor(n/60)).padStart(2,'0') + ':' + String(n%60).padStart(2,'0'); } };
  if (typeof module !== 'undefined') module.exports = api;
  else root.TrufDomain = api;
})(typeof window !== 'undefined' ? window : globalThis);
