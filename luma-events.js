(function () {
  'use strict';

  const list = document.getElementById('events-list');
  if (!list) return;

  const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'America/Puerto_Rico'
  });
  const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico'
  });

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function dateParts(value) {
    const parts = Object.fromEntries(
      DATE_FORMAT.formatToParts(new Date(value)).map((part) => [part.type, part.value])
    );
    return {
      date: `${parts.month} ${parts.day}`,
      weekday: parts.weekday
    };
  }

  function attendeeBlock(event) {
    const wrapper = make('div', 'event-attendees');
    const guests = event.featured_guests || [];

    if (!event.guest_count) {
      wrapper.setAttribute('aria-label', 'No public attendees yet on Luma');
      const empty = make('span', 'attendee-empty', '+');
      empty.setAttribute('aria-hidden', 'true');
      wrapper.append(empty);

      const copy = make('span');
      copy.append(make('strong', '', 'Be the first to join'), document.createElement('br'));
      copy.append(document.createTextNode('No public attendees yet on Luma'));
      wrapper.append(copy);
      return wrapper;
    }

    const names = guests.map((guest) => guest.name).filter(Boolean);
    wrapper.setAttribute(
      'aria-label',
      `${event.guest_count} people registered on Luma${names.length ? `: ${names.join(', ')}` : ''}`
    );

    const avatars = make('span', 'attendee-avatars');
    avatars.setAttribute('aria-hidden', 'true');
    guests.slice(0, 4).forEach((guest) => {
      if (!guest.avatar_url) return;
      const image = make('img', 'attendee-avatar');
      image.src = guest.avatar_url;
      image.alt = '';
      image.loading = 'lazy';
      avatars.append(image);
    });
    if (avatars.childElementCount) wrapper.append(avatars);

    const copy = make('span');
    copy.append(make('strong', '', `${event.guest_count} ${event.guest_count === 1 ? 'person' : 'people'} joined`));
    if (names.length) {
      copy.append(document.createElement('br'), document.createTextNode(names.join(' & ')));
    } else {
      copy.append(document.createElement('br'), document.createTextNode('View public guests on Luma'));
    }
    wrapper.append(copy);
    return wrapper;
  }

  function eventCard(event) {
    const fragment = document.createDocumentFragment();
    const date = dateParts(event.start_at);
    const dateLine = make('p', 'event-date-line', date.date + ' ');
    dateLine.append(make('span', '', date.weekday));
    fragment.append(dateLine);

    const card = make('a', 'event-card');
    card.href = event.url;
    card.target = '_blank';
    card.rel = 'noopener';
    card.setAttribute('aria-label', `View ${event.name} on Luma`);

    const copy = make('div');
    copy.append(
      make('p', 'event-time', `${TIME_FORMAT.format(new Date(event.start_at))}–${TIME_FORMAT.format(new Date(event.end_at))}`),
      make('h3', '', event.name)
    );
    const presenter = make('p', 'presenter');
    presenter.append(make('span', '', 'Presented by'), document.createTextNode(` ${event.presenter}`));
    copy.append(presenter, make('p', 'location', event.location), attendeeBlock(event));
    card.append(copy);

    if (event.cover_url) {
      const image = make('img', 'event-image');
      image.src = event.cover_url;
      image.alt = `${event.name} event artwork`;
      image.loading = 'lazy';
      card.append(image);
    }
    const arrow = make('span', 'event-arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(arrow);
    fragment.append(card);
    return fragment;
  }

  async function loadEvents() {
    try {
      const response = await fetch('assets/data/luma-events.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Event feed returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.events) || !data.events.length) return;
      const content = document.createDocumentFragment();
      data.events.forEach((event) => content.append(eventCard(event)));
      list.replaceChildren(content);
    } catch (error) {
      console.warn('Using the built-in event list because the Luma feed could not be loaded.', error);
    }
  }

  loadEvents();
})();
