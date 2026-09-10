from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Verify PostgreSQL, PostGIS, and GeoDjango spatial database support."

    def handle(self, *args, **options):
        self.stdout.write("FM-GDSS database health check")
        self.stdout.write("=" * 32)

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), version()")
                database_name, database_version = cursor.fetchone()
                self._ok(f"PostgreSQL connection ({database_name})")

                cursor.execute(
                    "SELECT extversion FROM pg_extension WHERE extname = 'postgis'"
                )
                postgis = cursor.fetchone()
                if not postgis:
                    raise CommandError(
                        "PostGIS extension is not enabled in this database. "
                        "Connect to the database and run CREATE EXTENSION postgis."
                    )
                self._ok(f"PostGIS extension ({postgis[0]})")

                cursor.execute(
                    "SELECT PostGIS_Version(), "
                    "ST_Area(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 0))', 4326))"
                )
                postgis_version, area = cursor.fetchone()
                if area != 0.5:
                    raise CommandError("PostGIS geometry operation returned an unexpected result.")
                self._ok(f"GeoDjango spatial query (PostGIS {postgis_version})")

            self._ok(f"Database engine ({connection.vendor})")
            self.stdout.write(f"Server: {database_version.splitlines()[0]}")
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(
                "Database health check failed. Verify PostgreSQL is running, the "
                f"credentials are correct, and database '{connection.settings_dict['NAME']}' exists. "
                f"Technical detail: {exc}"
            ) from exc

    def _ok(self, message):
        self.stdout.write(self.style.SUCCESS(f"[OK] {message}"))
