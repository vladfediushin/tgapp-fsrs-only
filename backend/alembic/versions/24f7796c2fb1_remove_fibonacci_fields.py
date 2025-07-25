"""remove_fibonacci_fields

Revision ID: 24f7796c2fb1
Revises: ffa6f5dd890b
Create Date: 2025-07-19 14:45:49.782191

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '24f7796c2fb1'
down_revision: Union[str, None] = 'ffa6f5dd890b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('user_progress', 'repetition_count')
    op.drop_column('user_progress', 'next_due_at')
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user_progress', sa.Column('next_due_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
    op.add_column('user_progress', sa.Column('repetition_count', sa.INTEGER(), autoincrement=False, nullable=False))
    # ### end Alembic commands ###
