from __future__ import annotations

import textwrap
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import subprocess

import pyttsx3
from PIL import Image, ImageDraw, ImageFont
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "media" / "presentacion_luro"
SLIDES_DIR = OUTPUT_DIR / "slides"
AUDIO_DIR = OUTPUT_DIR / "audio"
VIDEO_OUT = OUTPUT_DIR / "luro_control_presentacion_modulos.mp4"
SCRIPT_OUT = OUTPUT_DIR / "guion_narracion.txt"

W, H = 1920, 1080

FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_EMOJI = Path(r"C:\Windows\Fonts\seguiemj.ttf")


@dataclass
class Slide:
    title: str
    subtitle: str
    bullets: list[str]
    narration: str
    c1: tuple[int, int, int]
    c2: tuple[int, int, int]
    accent: tuple[int, int, int]


SLIDES: list[Slide] = [
    Slide(
        title="LuRo Control",
        subtitle="Presentacion de modulos clave del ecosistema operativo",
        bullets=[
            "Sistema integral para restaurantes y negocios operativos.",
            "Todo entra por almacen, se transforma en produccion y se vende en salida.",
            "Control, automatizacion y analitica en una sola plataforma.",
        ],
        narration=(
            "Bienvenido a LuRo Control. En este video conoceras los modulos mas importantes "
            "del sistema y como trabajan juntos para operar un negocio con orden, control y rentabilidad."
        ),
        c1=(8, 33, 72),
        c2=(12, 95, 148),
        accent=(89, 233, 255),
    ),
    Slide(
        title="🏠 Inicio",
        subtitle="Panel central del sistema",
        bullets=[
            "Vista general de estado operativo del negocio.",
            "Acceso rapido a los modulos mas usados.",
            "Monitoreo inicial para tomar decisiones diarias.",
        ],
        narration=(
            "El modulo Inicio funciona como centro de control. Desde aqui se visualiza "
            "el estado general del negocio y se accede rapidamente a cada area operativa."
        ),
        c1=(20, 43, 79),
        c2=(44, 104, 177),
        accent=(126, 216, 255),
    ),
    Slide(
        title="📦 Almacen",
        subtitle="Control de inventario y abastecimiento",
        bullets=[
            "Registro de existencias, entradas y movimientos de insumos.",
            "Deteccion de faltantes para evitar quiebres operativos.",
            "Base de datos real para costos, produccion y ventas.",
        ],
        narration=(
            "Almacen es la base del flujo LuRo. Aqui se controla inventario, entradas y faltantes, "
            "asegurando que la operacion tenga datos confiables para producir y vender."
        ),
        c1=(14, 59, 74),
        c2=(15, 123, 122),
        accent=(104, 255, 208),
    ),
    Slide(
        title="🚚 Distribuidores",
        subtitle="Gestion profesional de proveedores",
        bullets=[
            "Catalogo de suplidores y compras por proveedor.",
            "Trazabilidad de abastecimiento para cada insumo.",
            "Relacion directa entre compra, entrada y costo.",
        ],
        narration=(
            "Con Distribuidores, LuRo centraliza proveedores, compras y abastecimiento. "
            "Esto mejora negociacion, seguimiento y trazabilidad de cada adquisicion."
        ),
        c1=(62, 42, 20),
        c2=(173, 90, 39),
        accent=(255, 190, 120),
    ),
    Slide(
        title="🏭 Produccion Interna",
        subtitle="Transformacion controlada de insumos",
        bullets=[
            "Creacion de lotes y procesos productivos internos.",
            "Consumo trazable de materia prima por produccion.",
            "Control de rendimiento para evitar desperdicio.",
        ],
        narration=(
            "Produccion Interna permite transformar insumos en productos operativos con control real. "
            "Cada lote queda conectado al consumo, al costo y a la disponibilidad."
        ),
        c1=(36, 33, 78),
        c2=(74, 56, 155),
        accent=(182, 165, 255),
    ),
    Slide(
        title="👁️ Disponibilidad",
        subtitle="Lo que se puede vender ahora",
        bullets=[
            "Verifica disponibilidad basica y detallada por plato.",
            "Muestra estado real segun inventario y produccion.",
            "Reduce errores al momento de tomar pedidos.",
        ],
        narration=(
            "El modulo Disponibilidad confirma, en tiempo real, que platos pueden venderse. "
            "Asi se evita ofrecer productos sin stock y se mejora la experiencia del cliente."
        ),
        c1=(22, 52, 80),
        c2=(30, 97, 127),
        accent=(124, 236, 255),
    ),
    Slide(
        title="📤 Registrar Salida",
        subtitle="Ventas, cobro y cierre operativo",
        bullets=[
            "Gestion de detalle de venta por mesa o cliente.",
            "Control de facturacion y total a cobrar.",
            "Cierre conectado con inventario y reportes de ventas.",
        ],
        narration=(
            "Registrar Salida convierte operacion en ingresos. Gestiona cobro, facturacion y cierre de ventas, "
            "actualizando inventario y dejando trazabilidad completa."
        ),
        c1=(47, 24, 63),
        c2=(128, 38, 102),
        accent=(255, 144, 224),
    ),
    Slide(
        title="🕒 Asistencia",
        subtitle="Control de colaboradores por ciclo",
        bullets=[
            "Registro de entrada y salida por colaborador.",
            "Autorizacion por clave de usuario para marcaciones.",
            "Reporte consolidado por persona y por mes.",
        ],
        narration=(
            "Asistencia controla personal con seguridad. Registra entradas y salidas, solicita clave del colaborador "
            "y consolida reportes para seguimiento administrativo."
        ),
        c1=(20, 64, 53),
        c2=(22, 127, 94),
        accent=(131, 255, 194),
    ),
    Slide(
        title="📜 COMANDOS",
        subtitle="Centro de acciones operativas",
        bullets=[
            "Ejecucion rapida de tareas administrativas del sistema.",
            "Accesos directos para procesos recurrentes.",
            "Estandariza la operacion con acciones claras.",
        ],
        narration=(
            "El modulo Comandos simplifica tareas operativas repetitivas. "
            "Permite ejecutar acciones clave con rapidez y mantiene consistencia en la gestion."
        ),
        c1=(24, 34, 62),
        c2=(58, 72, 120),
        accent=(163, 187, 255),
    ),
    Slide(
        title="🧠 Asistente LuRo",
        subtitle="Soporte inteligente para ejecutar y consultar",
        bullets=[
            "Interfaz asistida para consultas y acciones del sistema.",
            "Ayuda a navegar modulos y resolver tareas mas rapido.",
            "Acelera decisiones con contexto operativo.",
        ],
        narration=(
            "Asistente LuRo actua como copiloto inteligente. Ayuda a consultar informacion, navegar modulos "
            "y ejecutar acciones con mayor velocidad y claridad."
        ),
        c1=(9, 49, 91),
        c2=(14, 118, 176),
        accent=(115, 226, 255),
    ),
    Slide(
        title="🧪 Agregar Plato",
        subtitle="Diseno comercial y control de costos",
        bullets=[
            "Creacion de platos con estructura de insumos.",
            "Relacion directa con costos y disponibilidad.",
            "Estandarizacion de oferta para cocina y ventas.",
        ],
        narration=(
            "Agregar Plato permite construir la oferta comercial con base operativa. "
            "Cada plato queda alineado a costos, inventario y disponibilidad en tiempo real."
        ),
        c1=(50, 41, 13),
        c2=(173, 120, 14),
        accent=(255, 215, 119),
    ),
    Slide(
        title="LuRo Control",
        subtitle="Un solo sistema para controlar todo el negocio",
        bullets=[
            "Operacion conectada de punta a punta.",
            "Menos errores, mas velocidad y mejores decisiones.",
            "Listo para escalar en equipos y sucursales.",
        ],
        narration=(
            "LuRo Control integra todos estos modulos en un ecosistema unico. "
            "Si quieres, en el siguiente paso podemos crear una version personalizada de este video con tu marca, "
            "contacto y llamada final de ventas."
        ),
        c1=(7, 35, 82),
        c2=(12, 88, 160),
        accent=(139, 225, 255),
    ),
]


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SLIDES_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def blend(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def pick_fonts() -> tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont, ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]:
    title_path = FONT_EMOJI if FONT_EMOJI.exists() else FONT_BOLD
    title_font = ImageFont.truetype(str(title_path), 84)
    subtitle_font = ImageFont.truetype(str(FONT_BOLD if FONT_BOLD.exists() else FONT_REG), 44)
    body_font = ImageFont.truetype(str(FONT_REG if FONT_REG.exists() else FONT_BOLD), 38)
    footer_font = ImageFont.truetype(str(FONT_REG if FONT_REG.exists() else FONT_BOLD), 28)
    return title_font, subtitle_font, body_font, footer_font


def draw_slide(slide: Slide, index: int, total: int) -> Path:
    title_font, subtitle_font, body_font, footer_font = pick_fonts()
    img = Image.new("RGB", (W, H), slide.c1)
    draw = ImageDraw.Draw(img)

    for y in range(H):
        t = y / max(1, H - 1)
        draw.line((0, y, W, y), fill=blend(slide.c1, slide.c2, t), width=1)

    draw.ellipse((W - 520, -130, W + 140, 510), fill=(*slide.accent, 85))
    draw.ellipse((-240, H - 380, 480, H + 220), fill=(255, 255, 255, 35))
    draw.rounded_rectangle((78, 74, W - 78, H - 82), radius=34, fill=(8, 14, 28, 140), outline=(255, 255, 255, 40), width=2)

    draw.text((132, 138), slide.title, font=title_font, fill=(248, 251, 255))
    draw.text((132, 252), slide.subtitle, font=subtitle_font, fill=(204, 230, 255))

    y = 370
    for bullet in slide.bullets:
        wrapped = textwrap.wrap(bullet, width=62)
        if not wrapped:
            continue
        draw.text((144, y), "•", font=subtitle_font, fill=(255, 255, 255))
        draw.text((184, y + 2), wrapped[0], font=body_font, fill=(242, 247, 255))
        y += 58
        for line in wrapped[1:]:
            draw.text((184, y + 2), line, font=body_font, fill=(230, 239, 255))
            y += 50
        y += 12

    footer = f"LuRo Control · Presentacion de modulos ({index}/{total})"
    draw.text((132, H - 126), footer, font=footer_font, fill=(188, 212, 241))

    out_path = SLIDES_DIR / f"slide_{index:02d}.png"
    img.save(out_path, format="PNG")
    return out_path


def pick_spanish_voice(engine: pyttsx3.Engine) -> None:
    voices = engine.getProperty("voices")
    if not voices:
        return
    preferred = None
    fallback = None
    for voice in voices:
        blob = " ".join(
            [
                str(getattr(voice, "id", "")),
                str(getattr(voice, "name", "")),
                str(getattr(voice, "languages", "")),
            ]
        ).lower()
        if "spanish" in blob or "es_" in blob or "es-" in blob or "español" in blob:
            preferred = voice.id
            break
        if fallback is None:
            fallback = voice.id
    engine.setProperty("voice", preferred or fallback)
    engine.setProperty("rate", 168)
    engine.setProperty("volume", 1.0)


def synthesize_with_powershell(text: str, out_file: Path) -> None:
    safe_text = text.replace("'", "''")
    safe_path = str(out_file).replace("'", "''")
    script = (
        "Add-Type -AssemblyName System.Speech; "
        "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$voice = $synth.GetInstalledVoices() | Where-Object { "
        "$_.VoiceInfo.Culture.Name -like 'es*' -or $_.VoiceInfo.Name -like '*Spanish*' "
        "} | Select-Object -First 1; "
        "if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }; "
        "$synth.Rate = 0; $synth.Volume = 100; "
        f"$synth.SetOutputToWaveFile('{safe_path}'); "
        f"$synth.Speak('{safe_text}'); "
        "$synth.Dispose();"
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", script],
        check=True,
        capture_output=True,
        text=True,
    )


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        if rate <= 0:
            return 0.0
        return frames / float(rate)


def generate_audios(slides: Iterable[Slide]) -> list[Path]:
    out_files: list[Path] = []
    for idx, slide in enumerate(slides, start=1):
        out = AUDIO_DIR / f"audio_{idx:02d}.wav"
        if out.exists():
            out.unlink()
        try:
            synthesize_with_powershell(slide.narration, out)
        except Exception:
            engine = pyttsx3.init()
            pick_spanish_voice(engine)
            engine.save_to_file(slide.narration, str(out))
            engine.runAndWait()
            engine.stop()
        out_files.append(out)
    return out_files


def build_video(slide_paths: list[Path], audio_paths: list[Path]) -> None:
    clips = []
    for img_path, aud_path in zip(slide_paths, audio_paths, strict=True):
        base_dur = wav_duration(aud_path)
        trim_end = max(0.08, base_dur - 0.05)
        audio = AudioFileClip(str(aud_path)).subclipped(0, trim_end)
        duration = max(0.08, audio.duration)
        video = ImageClip(str(img_path)).with_duration(duration)
        clips.append(video.with_audio(audio))

    final = concatenate_videoclips(clips, method="compose")
    final.write_videofile(
        str(VIDEO_OUT),
        fps=30,
        codec="libx264",
        audio_codec="aac",
        bitrate="6000k",
        audio_bitrate="192k",
        preset="medium",
        threads=4,
    )
    final.close()
    for c in clips:
        c.close()


def write_script(slides: Iterable[Slide]) -> None:
    lines = ["GUION DE NARRACION - PRESENTACION MODULOS LURO CONTROL", ""]
    for i, slide in enumerate(slides, start=1):
        lines.append(f"{i}. {slide.title}")
        lines.append(slide.narration)
        lines.append("")
    SCRIPT_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    total = len(SLIDES)
    slide_paths = [draw_slide(s, i, total) for i, s in enumerate(SLIDES, start=1)]
    audio_paths = generate_audios(SLIDES)
    build_video(slide_paths, audio_paths)
    write_script(SLIDES)
    print(f"VIDEO_OK: {VIDEO_OUT}")
    print(f"GUION_OK: {SCRIPT_OUT}")


if __name__ == "__main__":
    main()
