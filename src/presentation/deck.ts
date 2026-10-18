export interface PitchSlide {
  number: string;
  chapter: string;
  eyebrow: string;
  title: string;
  emphasis: string;
  summary: string;
  cue: string;
  notes: string[];
}

export const pitchSlides: PitchSlide[] = [
  {
    number: "01",
    chapter: "The problem",
    eyebrow: "A SMALL CHANGE BREAKS THE FLOW",
    title: "The beat is good.",
    emphasis: "The edit should be easy.",
    summary: "One more drum hit. A little less bass. Then suddenly you are searching through text.",
    cue: "A beat plays. Someone searches a full screen of code for one drum hit.",
    notes: [
      "Imagine you’ve made a beat you like.",
      "Now you want one more drum hit. Or a little less bass.",
      "It’s a small musical change. But when the music is written in code, you have to find the right place and type the right thing.",
      "[Pause.] You were making music. Now you’re searching through text.",
    ],
  },
  {
    number: "02",
    chapter: "The question",
    eyebrow: "THE QUESTION",
    title: "What if you could",
    emphasis: "play the code?",
    summary:
      "Keep the power of music code. Make the little changes as naturally as tapping a beat.",
    cue: "The code stays in view while a drum grid and a knob enter beside it.",
    notes: [
      "That led us to one question:",
      "What if you could keep the power of music code—but change it as naturally as turning a knob or tapping a beat?",
      "What if you didn’t have to choose between writing music and playing it?",
    ],
  },
  {
    number: "03",
    chapter: "The idea",
    eyebrow: "ONE SOURCE OF TRUTH",
    title: "The code is",
    emphasis: "the song.",
    summary:
      "Controls are another way to touch it. No hidden copy. No separate arrangement to keep in sync.",
    cue: "A line connects a knob and a beat grid to their exact values in the code.",
    notes: [
      "Our idea is simple.",
      "The code is the song. The controls are another way to touch it.",
      "A knob is connected to a value in the code. A drum grid is connected to a beat in the code.",
      "There is only one song—not a hidden copy behind the screen.",
    ],
  },
  {
    number: "04",
    chapter: "The solution",
    eyebrow: "MEET JAMSCRIPT",
    title: "Turn. Tap.",
    emphasis: "Keep playing.",
    summary:
      "A knob moves a number. A step moves a beat. Type in the code and the controls follow.",
    cue: "The animated knob and grid update only their linked source values.",
    notes: [
      "We’re building JamScript on top of Strudel, a tool that plays music from code.",
      "JamScript adds controls beside the music code. Turn a knob, and its number changes. Change the number, and the knob follows.",
      "[Animation: one grid cell lights; its matching pattern character changes.]",
      "Tap a beat, and the matching part of the code changes too.",
      "You can work with your hands, with your keyboard, or both.",
    ],
  },
  {
    number: "05",
    chapter: "Safety",
    eyebrow: "DON’T GUESS",
    title: "If it is not safe,",
    emphasis: "leave it in code.",
    summary:
      "Simple patterns get controls. Complex expressions stay editable as code, without risky automatic rewrites.",
    cue: "A simple rhythm opens as a grid. A complex pattern shows a lock.",
    notes: [
      "But music code can be complicated.",
      "If JamScript cannot safely turn a pattern into a control, it doesn’t guess. That control stays locked. The code is still there for you to edit.",
      "Our rule is: if we cannot make a safe change, we do not make one.",
    ],
  },
  {
    number: "06",
    chapter: "Who it is for",
    eyebrow: "A NEW WAY TO STAY IN THE MOMENT",
    title: "For coders.",
    emphasis: "For musicians.",
    summary:
      "Write with your keyboard, shape sound by hand, and see the same song from both sides.",
    cue: "One person types; another taps a grid. Both look at the same song.",
    notes: [
      "This is for people who make music with code but want to stay in the moment.",
      "For developers who want to shape sound by hand. And for musicians who are curious about code, but don’t want the code to get in the way.",
    ],
  },
  {
    number: "07",
    chapter: "Closing",
    eyebrow: "JAMSCRIPT",
    title: "Stay with",
    emphasis: "the music.",
    summary: "Code is the source. Lenses are how you play it.",
    cue: "The controls fade into the source. The JamScript name remains.",
    notes: [
      "We started with a small frustration: a simple change shouldn’t interrupt a good idea.",
      "JamScript brings the controls to the code, so you can keep making music.",
      "[Pause.] Code is the source. Lenses are how you play it.",
      "Thank you.",
    ],
  },
];
