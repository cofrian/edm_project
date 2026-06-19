"""Genera city_events.json desde CSV semilla + reglas recurrentes."""

from __future__ import annotations

import csv
import json
import os
import sys
from datetime import date, datetime, timedelta
from typing import Any

from common import BACKEND, OUT_DATA, ensure_dirs

RAW_CSV = os.path.join(BACKEND, "data", "raw", "valencia_events_seed.csv")

VENUES = {
    "roig_arena": (39.4560, -0.3465, "C/ Bomber Ramon Duart 12, Valencia"),
    "ciutat_valencia": (39.4945, -0.3638, "Estadio Ciutat de València"),
    "mestalla": (39.4747, -0.3583, "Camp de Mestalla"),
    "viveros": (39.4795, -0.3668, "Jardines de Viveros"),
    "marina_norte": (39.4605, -0.3240, "Marina Norte, Valencia"),
    "carpa_alegria": (39.4590, -0.3280, "Av. Ing. Manuel Soto 11"),
    "mya_umbracle": (39.4562, -0.3540, "Ciudad de las Artes y las Ciencias"),
    "committee": (39.4625, -0.3750, "C/ Sant Vicent Màrtir 200"),
    "valvanera": (39.4690, -0.3780, "Pl. Santiago Suárez"),
    "ruzafa": (39.4630, -0.3715, "Pl. Barón de Cortés"),
    "cabanyal": (39.4635, -0.3305, "Cabañal, Valencia"),
    "betero": (39.4940, -0.3320, "Beteró, Valencia"),
    "tapineria": (39.4765, -0.3755, "Mercado de Tapinería"),
    "pobla_farnals": (39.5760, -0.2830, "Pl. Cortes Valencianas, La Pobla de Farnals"),
    "aragon_mestalla": (39.4745, -0.3580, "Av. de Aragón, Mestalla"),
}


def _iso(d: str, t: str, duration_h: float = 3.0) -> tuple[str, str]:
    start = datetime.fromisoformat(f"{d}T{t}:00+02:00")
    end = start + timedelta(hours=duration_h)
    return start.isoformat(), end.isoformat()


def _event(
    eid: str,
    nombre: str,
    tipo: str,
    d: str,
    hora: str,
    venue: str,
    *,
    duration_h: float = 3.0,
    radio: float = 400,
    factor: float = 1.3,
    fuente: str = "manual",
    enlace: str = "",
) -> dict[str, Any]:
    lat, lon, direccion = VENUES[venue]
    ini, fin = _iso(d, hora, duration_h)
    return {
        "id": eid,
        "nombre": nombre,
        "tipo": tipo,
        "inicio": ini,
        "fin": fin,
        "lat": lat,
        "lon": lon,
        "direccion": direccion,
        "radio_metros": radio,
        "factor_max": factor,
        "fuente": fuente,
        "enlace": enlace,
    }


def _read_csv(path: str) -> list[dict[str, Any]]:
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            venue = r["venue"]
            lat, lon, direccion = VENUES[venue]
            ini, fin = _iso(r["fecha"], r["hora"], float(r.get("duration_h", 3)))
            rows.append({
                "id": r["id"],
                "nombre": r["nombre"],
                "tipo": r["tipo"],
                "inicio": ini,
                "fin": fin,
                "lat": lat,
                "lon": lon,
                "direccion": direccion,
                "radio_metros": float(r.get("radio_metros", 400)),
                "factor_max": float(r.get("factor_max", 1.3)),
                "fuente": r.get("fuente", "manual"),
                "enlace": r.get("enlace", ""),
            })
    return rows


def _recurring_mercadillos(start: date, end: date) -> list[dict[str, Any]]:
    rules = [
        ("ruzafa", 0, "09:00", 5.0, 250, 1.1),  # lunes
        ("cabanyal", 3, "09:00", 5.0, 250, 1.1),  # jueves
        ("betero", 6, "09:00", 5.0, 250, 1.1),  # domingo
    ]
    out = []
    d = start
    while d <= end:
        for venue, wd, hora, dur, radio, factor in rules:
            if d.weekday() == wd:
                eid = f"mercadillo-{venue}-{d.isoformat()}"
                out.append(_event(
                    eid, f"Mercadillo {venue.replace('_', ' ').title()}", "mercadillo",
                    d.isoformat(), hora, venue, duration_h=dur, radio=radio, factor=factor,
                    fuente="ayuntamiento_valencia",
                ))
        d += timedelta(days=1)
    return out


def _recurring_nightlife(start: date, end: date) -> list[dict[str, Any]]:
    out = []
    d = start
    while d <= end:
        wd = d.weekday()
        if wd in (4, 5):  # vie, sáb
            out.append(_event(
                f"mya-{d.isoformat()}",
                "Mya + L'Umbracle (noche)",
                "ocio_nocturno",
                d.isoformat(), "00:00", "mya_umbracle",
                duration_h=7.0, radio=300, factor=1.15,
                fuente="grupo_salamandra",
                enlace="https://eventosgruposalamandra.com/",
            ))
        if wd in (3, 4, 5):  # jue–sáb Committee
            out.append(_event(
                f"committee-{d.isoformat()}",
                "Committee Valencia",
                "ocio_nocturno",
                d.isoformat(), "00:00", "committee",
                duration_h=7.0, radio=200, factor=1.1,
                fuente="grupo_salamandra",
            ))
        d += timedelta(days=1)
    return out


def _builtin_events() -> list[dict[str, Any]]:
    """Eventos puntuales investigados (14 jun – 15 jul 2026)."""
    ev = []
    # Deporte
    for i, (d, h, name) in enumerate([
        ("2026-06-14", "08:30", "VII Volta a Peu Runners 5K"),
        ("2026-06-18", "20:00", "Final ACB P1: Valencia Basket vs FC Barcelona"),
        ("2026-06-20", "20:00", "Final ACB P2: Valencia Basket vs FC Barcelona"),
        ("2026-06-22", "20:00", "Final ACB P3: Valencia Basket vs FC Barcelona"),
        ("2026-06-27", "20:00", "Final ACB P5 / Gay Games"),
    ], 1):
        venue = "aragon_mestalla" if "Volta" in name else ("roig_arena" if "ACB" in name else "ciutat_valencia")
        ev.append(_event(
            f"deporte-{i}", name, "deporte" if "ACB" in name or "Volta" in name else "evento",
            d, h, venue, duration_h=2.5 if "Volta" in name else 3.0,
            radio=500 if "ciutat" in venue else 400,
            factor=1.4 if "ACB" in name else 1.25,
            fuente="fdm_valencia" if "Volta" in name else "acb.com",
        ))

    # Viveros jul 2-15
    viveros = [
        ("2026-07-02", "20:00", "Duncan Dhu"),
        ("2026-07-03", "19:00", "Javi Medina + Gonzalo Alhambra + Jalezz"),
        ("2026-07-04", "20:00", "Septeto Acarey"),
        ("2026-07-05", "20:00", "Valeria Castro"),
        ("2026-07-06", "20:00", "Danny Ocean"),
        ("2026-07-07", "20:00", "Deep Purple"),
        ("2026-07-08", "20:00", "Garbage + Humanian"),
        ("2026-07-09", "19:00", "Juan Magán + invitados"),
        ("2026-07-11", "19:00", "Ultraligera + Conociendo Rusia"),
        ("2026-07-12", "20:00", "Tony Hadley"),
        ("2026-07-14", "20:00", "Ana Torroja"),
        ("2026-07-15", "20:00", "UB40 feat. Ali Campbell"),
    ]
    for d, h, art in viveros:
        slug = art.lower().replace(" ", "-")[:30]
        ev.append(_event(
            f"viveros-{d}-{slug}", f"{art} — Viveros", "concierto",
            d, h, "viveros", duration_h=3.5, radio=500, factor=1.35,
            fuente="ayuntamiento_valencia",
            enlace="https://www.conciertosdeviverosvlc.com/",
        ))

    # FAR 8-15 jul
    far = [
        ("2026-07-08", "21:00", "Jean-Michel Jarre"),
        ("2026-07-09", "21:00", "Babasónicos + El Zar"),
        ("2026-07-10", "21:00", "Silvana Estrada + Judeline"),
        ("2026-07-11", "21:00", "Meute"),
        ("2026-07-12", "21:00", "Luz Casal"),
        ("2026-07-14", "21:00", "Elvis Crespo"),
        ("2026-07-15", "21:00", "Antoñito Molina"),
    ]
    for d, h, art in far:
        ev.append(_event(
            f"far-{d}", f"{art} — FAR Valencia", "concierto",
            d, h, "marina_norte", duration_h=3.0, radio=600, factor=1.35,
            fuente="farvalencia.es", enlace="https://www.farvalencia.es/",
        ))

    # Roig Arena
    roig = [
        ("2026-06-19", "20:30", "NMF Live: Reality, Faenna, Santa Salut"),
        ("2026-06-20", "17:00", "TUMU Festival"),
        ("2026-06-21", "21:00", "Slava Komissarenko"),
        ("2026-06-26", "21:00", "This is Michael"),
        ("2026-06-27", "21:00", "God Save The Queen"),
        ("2026-06-30", "21:00", "Rod Stewart"),
        ("2026-07-03", "20:30", "Kany García"),
        ("2026-07-08", "21:00", "La Reina del Flow"),
    ]
    for d, h, name in roig:
        ev.append(_event(
            f"roig-{d}", name, "concierto", d, h, "roig_arena",
            duration_h=3.0, radio=450, factor=1.35,
            fuente="roigarena.com", enlace="https://www.roigarena.com/es/eventos/",
        ))

    # Levante Fever Fest
    for d, h, name in [
        ("2026-07-04", "21:00", "El Último de la Fila"),
        ("2026-07-09", "21:00", "El Último de la Fila (2º pase)"),
        ("2026-07-11", "22:00", "Alejandro Sanz"),
    ]:
        ev.append(_event(
            f"fever-{d}", name, "concierto", d, h, "ciutat_valencia",
            duration_h=3.5, radio=600, factor=1.5,
            fuente="levantefeverfest.com", enlace="https://levantefeverfest.com/",
        ))

    # Cirque du Soleil (funciones representativas jun)
    for d in ["2026-06-14", "2026-06-15", "2026-06-20", "2026-06-21", "2026-06-27", "2026-06-28"]:
        ev.append(_event(
            f"alegria-{d}", "Cirque du Soleil — Alegría", "espectaculo",
            d, "20:30", "carpa_alegria", duration_h=2.5, radio=400, factor=1.2,
            fuente="cirquedusoleil.com",
        ))

    # Mercadillos puntuales
    ev.append(_event(
        "flea-valvanera-2026-06-21", "Flea Market Valvanera", "mercadillo",
        "2026-06-21", "11:00", "valvanera", duration_h=4.0, radio=200, factor=1.1,
    ))
    for d in ["2026-07-03", "2026-07-04", "2026-07-05"]:
        ev.append(_event(
            f"medieval-pobla-{d}", "Mercado Medieval La Pobla de Farnals", "mercadillo",
            d, "18:00", "pobla_farnals", duration_h=6.0, radio=350, factor=1.15,
        ))
    ev.append(_event(
        "enfocart-2026-07-03", "Enfocart — Mercado Tapinería", "mercadillo",
        "2026-07-03", "11:00", "tapineria", duration_h=8.0, radio=200, factor=1.1,
    ))

    # Carreras
    carreras = [
        ("2026-06-21", "09:00", "Ponle Freno 5K/10K Valencia", "mestalla"),
        ("2026-06-27", "09:00", "10K Alboraya Contra el Cáncer", "marina_norte"),
        ("2026-07-05", "09:00", "Legua urbana Torrent", "ruzafa"),
        ("2026-07-10", "20:00", "38ª Volta a Peu Alzira", "marina_norte"),
    ]
    for d, h, name, v in carreras:
        ev.append(_event(
            f"carrera-{d}", name, "carrera", d, h, v, duration_h=3.0, radio=500, factor=1.2,
            fuente="runedia",
        ))

    return ev


def main() -> int:
    ensure_dirs()
    os.makedirs(os.path.dirname(RAW_CSV), exist_ok=True)
    start = date(2026, 6, 14)
    end = date(2026, 7, 15)

    events = _builtin_events()
    events.extend(_read_csv(RAW_CSV))
    events.extend(_recurring_mercadillos(start, end))
    events.extend(_recurring_nightlife(start, end))

    # deduplicar por id
    seen: set[str] = set()
    unique = []
    for e in events:
        if e["id"] in seen:
            continue
        seen.add(e["id"])
        unique.append(e)

    unique.sort(key=lambda x: x["inicio"])
    out_path = os.path.join(OUT_DATA, "city_events.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "generated": datetime.now().isoformat(),
                "from": start.isoformat(),
                "to": end.isoformat(),
                "count": len(unique),
            },
            "events": unique,
        }, f, ensure_ascii=False, indent=2)
    print(f"[OK] city_events.json ({len(unique)} eventos) -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
