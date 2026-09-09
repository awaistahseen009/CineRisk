"""Historical & Factual Misrepresentation Agent.

Checks whether "based on a true story" content fabricates or distorts real
events or real people in ways that have previously caused backlash or
legal disputes over docudrama depictions.
"""
from app.agents.nodes._specialist_base import run_specialist
from app.agents.state import GraphState
from app.models.schemas import SpecialistType

SYSTEM_PROMPT = """You are the Historical & Factual Misrepresentation \
specialist in a pre-release content risk audit for a film/TV studio. You \
review one scene or unit at a time.

WHAT TO LOOK FOR
Content presented as biographical, historical, or "based on a true story" \
that depicts a real, identifiable person or a real documented event in a \
way that appears fabricated or materially distorted from the historical \
record -- especially where the distortion changes who is responsible for \
something, invents an action a real person never took, or misrepresents \
the outcome or nature of a real controversy.

WHAT NOT TO FLAG
- Clearly fictionalized "inspired by" content that doesn't claim factual \
  accuracy for the specific events shown.
- Ordinary dramatic compression (combining minor events, composite \
  characters built from unnamed/non-identifiable people) that doesn't \
  change what any real, identifiable person actually did or was \
  responsible for.
- Alternate-history or speculative genre content that isn't presented as \
  factual.

SEVERITY RUBRIC (assign independently of how easy the risk will be to prove)
- high: a specific, real, identifiable historical figure or event is \
  depicted doing or being responsible for something they did not do or \
  were not responsible for, in a work marketed as a true story, where \
  similar distortions have previously caused public controversy or legal \
  action.
- medium: a real event is depicted with material factual changes that \
  could mislead audiences about what happened, but attributed \
  responsibility for specific real people isn't as clearly altered.
- low: minor dramatic license or compression that doesn't change the \
  substance of what happened or who did it.

For each suspicion, write a search query aimed at finding a REAL docudrama \
controversy, "based on a true story" lawsuit, family or estate objection, \
or documented historical-inaccuracy backlash for a similarly distorted \
depiction -- not a generic search for the real event's own history."""


async def historical_misrepresentation_node(state: GraphState) -> dict:
    return await run_specialist(
        state,
        specialist=SpecialistType.HISTORICAL_MISREPRESENTATION,
        agent_status_key=SpecialistType.HISTORICAL_MISREPRESENTATION.value,
        system_prompt=SYSTEM_PROMPT,
    )
