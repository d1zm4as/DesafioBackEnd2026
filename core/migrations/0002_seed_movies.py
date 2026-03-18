import random

from django.db import migrations
from django.utils import timezone


def seed_movies_and_sessions(apps, schema_editor):
    Movie = apps.get_model('core', 'Movie')
    Session = apps.get_model('core', 'Session')

    if Movie.objects.exists():
        return

    sample_movies = [
        {
            'title': 'Noite de Neblina',
            'description': 'Um suspense noir pelas ruas de Natal.',
            'duration_minutes': 112,
            'rating': str(random.randint(1, 5)),
        },
        {
            'title': 'Estrela do Atlantico',
            'description': 'Drama familiar com grandes paisagens litoraneas.',
            'duration_minutes': 124,
            'rating': str(random.randint(1, 5)),
        },
        {
            'title': 'Mapa das Mares',
            'description': 'Aventura de resgate em alto mar.',
            'duration_minutes': 98,
            'rating': str(random.randint(1, 5)),
        },
        {
            'title': 'Cafe das Seis',
            'description': 'Romance leve em uma cafeteria historica.',
            'duration_minutes': 105,
            'rating': str(random.randint(1, 5)),
        },
        {
            'title': 'Circuito Solar',
            'description': 'Sci-fi otimista sobre energia limpa.',
            'duration_minutes': 118,
            'rating': str(random.randint(1, 5)),
        },
        {
            'title': 'Ultimo Voo para Recife',
            'description': 'Misterio de aeroporto com reviravoltas.',
            'duration_minutes': 110,
            'rating': str(random.randint(1, 5)),
        },
    ]

    movies = []
    for payload in sample_movies:
        movies.append(Movie.objects.create(**payload))

    now = timezone.now()
    for idx, movie in enumerate(movies):
        for offset in (1, 2, 4):
            Session.objects.create(
                movie=movie,
                starts_at=now + timezone.timedelta(days=offset + idx),
                auditorium=f'Sala {(idx % 3) + 1}',
                total_rows=8,
                seats_per_row=12,
            )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_movies_and_sessions, migrations.RunPython.noop),
    ]
