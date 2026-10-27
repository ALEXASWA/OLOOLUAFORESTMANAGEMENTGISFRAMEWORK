from pathlib import Path

from django.core.management.base import BaseCommand
from PIL import Image, ImageChops

from apps.gis_layers.models import MapProduct

PREVIEW_MAX = 2200


class Command(BaseCommand):
    help = (
        "Create gallery thumbnails (640px) and screen previews (2200px) for registered image map "
        "products without changing originals."
    )

    def add_arguments(self, parser):
        parser.add_argument("--forest", default="oloolua")

    def handle(self, *args, **options):
        products = MapProduct.objects.filter(forest__code=options["forest"], product_type="image")
        created = skipped = 0
        previews_created = previews_skipped = 0
        for product in products:
            source = Path(product.file_path)
            if not source.is_file():
                self.stdout.write(self.style.WARNING(f"MISSING {source}"))
                continue
            output = source.parent / "thumbnails" / f"{source.stem}.jpg"
            preview = source.parent / "previews" / f"{source.stem}.jpg"
            need_thumbnail = not output.exists()
            need_preview = not preview.exists()
            if not need_thumbnail and not need_preview:
                skipped += 1
                previews_skipped += 1
                continue
            if need_thumbnail:
                output.parent.mkdir(parents=True, exist_ok=True)
            if need_preview:
                preview.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as opened:
                opened.draft("RGB", (PREVIEW_MAX * 2, PREVIEW_MAX * 2))
                image = opened.convert("RGB")
                if need_thumbnail:
                    thumbnail = self._trim_border(image.copy())
                    thumbnail.thumbnail((640, 640), Image.Resampling.LANCZOS)
                    thumbnail.save(output, "JPEG", quality=86, optimize=True)
                    created += 1
                else:
                    skipped += 1
                if need_preview:
                    screen = image.copy()
                    screen.thumbnail((PREVIEW_MAX, PREVIEW_MAX), Image.Resampling.LANCZOS)
                    screen.save(preview, "JPEG", quality=82, optimize=True, progressive=True)
                    previews_created += 1
                else:
                    previews_skipped += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Map thumbnails: {created} created, {skipped} already present. "
                f"Previews: {previews_created} created, {previews_skipped} already present."
            )
        )

    def _trim_border(self, image):
        edge = Image.new("RGB", image.size, image.getpixel((0, 0)))
        diff = ImageChops.difference(image, edge)
        bbox = diff.point(lambda value: 255 if value > 12 else 0).getbbox()
        if not bbox:
            return image
        left, top, right, bottom = bbox
        margin_x = max(4, int(image.width * 0.01))
        margin_y = max(4, int(image.height * 0.01))
        if left < image.width * 0.08 and top < image.height * 0.08 and right > image.width * 0.92 and bottom > image.height * 0.92:
            return image.crop((max(0, left - margin_x), max(0, top - margin_y), min(image.width, right + margin_x), min(image.height, bottom + margin_y)))
        return image
