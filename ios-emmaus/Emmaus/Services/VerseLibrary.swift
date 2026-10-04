import Foundation

/// A small offline collection of public-domain (KJV) verses for the daily verse.
enum VerseLibrary {
    static let verses: [Verse] = [
        Verse(reference: "Luke 24:32", text: "Did not our heart burn within us, while he talked with us by the way, and while he opened to us the scriptures?", theme: "The Road"),
        Verse(reference: "Psalm 46:10", text: "Be still, and know that I am God.", theme: "Stillness"),
        Verse(reference: "Isaiah 41:10", text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.", theme: "Courage"),
        Verse(reference: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", theme: "Rest"),
        Verse(reference: "Proverbs 3:5–6", text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.", theme: "Trust"),
        Verse(reference: "Philippians 4:6–7", text: "In every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.", theme: "Peace"),
        Verse(reference: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want.", theme: "Provision"),
        Verse(reference: "Lamentations 3:22–23", text: "His compassions fail not. They are new every morning: great is thy faithfulness.", theme: "Mercy"),
        Verse(reference: "John 14:27", text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.", theme: "Peace"),
        Verse(reference: "Romans 8:28", text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.", theme: "Purpose"),
        Verse(reference: "Joshua 1:9", text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", theme: "Courage"),
        Verse(reference: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path.", theme: "Light"),
        Verse(reference: "Isaiah 40:31", text: "They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.", theme: "Strength"),
        Verse(reference: "2 Corinthians 12:9", text: "My grace is sufficient for thee: for my strength is made perfect in weakness.", theme: "Grace"),
        Verse(reference: "Matthew 5:14", text: "Ye are the light of the world. A city that is set on an hill cannot be hid.", theme: "Calling"),
        Verse(reference: "John 1:5", text: "And the light shineth in darkness; and the darkness comprehended it not.", theme: "Light"),
        Verse(reference: "Psalm 34:18", text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.", theme: "Comfort"),
        Verse(reference: "Micah 6:8", text: "What doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?", theme: "Humility"),
        Verse(reference: "1 John 4:18", text: "There is no fear in love; but perfect love casteth out fear.", theme: "Love"),
        Verse(reference: "Hebrews 11:1", text: "Now faith is the substance of things hoped for, the evidence of things not seen.", theme: "Faith"),
        Verse(reference: "Romans 12:12", text: "Rejoicing in hope; patient in tribulation; continuing instant in prayer.", theme: "Hope"),
        Verse(reference: "Zephaniah 3:17", text: "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.", theme: "Delight"),
        Verse(reference: "James 1:5", text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.", theme: "Wisdom"),
        Verse(reference: "Psalm 139:14", text: "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works.", theme: "Identity"),
        Verse(reference: "Matthew 7:7", text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", theme: "Prayer"),
        Verse(reference: "Galatians 5:22–23", text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, meekness, temperance.", theme: "Fruit"),
        Verse(reference: "1 Peter 5:7", text: "Casting all your care upon him; for he careth for you.", theme: "Care"),
        Verse(reference: "Psalm 27:1", text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?", theme: "Light"),
        Verse(reference: "John 3:16", text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", theme: "Love"),
        Verse(reference: "Isaiah 43:2", text: "When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee.", theme: "Presence"),
        Verse(reference: "Numbers 6:24–26", text: "The LORD bless thee, and keep thee: the LORD make his face shine upon thee, and be gracious unto thee: the LORD lift up his countenance upon thee, and give thee peace.", theme: "Blessing"),
    ]

    /// Deterministic verse for a given day.
    static func verseOfTheDay(for date: Date = .now) -> Verse {
        let day = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 1
        return verses[(day - 1) % verses.count]
    }

    static func random(excluding verse: Verse) -> Verse {
        verses.filter { $0 != verse }.randomElement() ?? verse
    }
}
