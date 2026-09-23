#!/usr/bin/env python3
"""Sync public events from Ralf's Luma calendar into a static JSON feed."""

from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


CALENDAR_URL = "https://luma.com/ralfsgameclub?k=c"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "assets" / "data" / "luma-events.json"
ACCESS_PATH = Path(__file__).resolve().parents[1] / "assets" / "data" / "event-access.json"


def fetch_calendar() -> str:
    request = urllib.request.Request(
        CALENDAR_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; RalfsGameClubEventSync/1.0; "
                "+https://ralfsgameclub.com/)"
            )
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def extract_calendar_data(page: str) -> dict:
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        page,
        re.DOTALL,
    )
    if not match:
        raise RuntimeError("Luma calendar data was not found in the public page.")

    next_data = json.loads(match.group(1))
    initial_data = next_data["props"]["pageProps"]["initialData"]
    if initial_data.get("kind") != "calendar":
        raise RuntimeError("The Luma page did not return calendar data.")
    return initial_data["data"]


def public_guest(guest: dict) -> dict:
    return {
        "name": guest.get("name") or guest.get("first_name") or "Guest",
        "avatar_url": guest.get("avatar_url"),
    }


def external_end_at(start_at: str, duration: str = "") -> str:
    match = re.fullmatch(r"P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
    if not match:
        return start_at
    end = datetime.fromisoformat(start_at.replace("Z", "+00:00")) + timedelta(
        hours=int(match.group(1) or 0),
        minutes=int(match.group(2) or 0),
        seconds=int(match.group(3) or 0),
    )
    return end.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def public_event(entry: dict) -> dict:
    event = entry["event"]
    calendar = entry.get("calendar") or {}
    address = event.get("geo_address_info") or {}
    guests = [public_guest(guest) for guest in entry.get("featured_guests") or []]
    event_url = event["url"]
    if not event_url.startswith(("https://", "http://")):
        event_url = f"https://luma.com/{event_url}"
    return {
        "id": event.get("api_id") or entry.get("api_id") or event_url,
        "name": event["name"],
        "url": event_url,
        "start_at": event["start_at"],
        "end_at": event.get("end_at") or external_end_at(event["start_at"], event.get("duration_interval")),
        "timezone": event.get("timezone") or calendar.get("timezone") or "America/Puerto_Rico",
        "cover_url": event.get("cover_url") or event.get("social_image_url"),
        "presenter": calendar.get("name") or event.get("host") or "Ralf's Game Club",
        "location": address.get("short_address") or address.get("full_address") or "San Juan",
        "guest_count": entry.get("guest_count") or 0,
        "featured_guests": guests,
    }


def load_access_overrides() -> dict:
    if not ACCESS_PATH.exists():
        return {}
    return json.loads(ACCESS_PATH.read_text(encoding="utf-8"))


def main() -> None:
    calendar_data = extract_calendar_data(fetch_calendar())
    entries = calendar_data.get("upcoming", {}).get("entries", [])
    access_overrides = load_access_overrides()
    events = []
    for entry in entries:
        event = public_event(entry)
        event.update(access_overrides.get(event["id"], {}))
        events.append(event)
    events.sort(key=lambda item: item["start_at"])
    payload = {
        "source": CALENDAR_URL,
        "events": events,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Synced {len(events)} public Luma events.")


if __name__ == "__main__":
    main()
