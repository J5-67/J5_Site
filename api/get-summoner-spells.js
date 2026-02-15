export default async function handler(req, res) {
  const { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  try {
    // 1. Account-v1 호출
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
    const accountData = await accountRes.json();
    
    if (!accountData.puuid) {
        return res.status(200).json({ error: 'summoner_not_found', tier: "미검색", record: "" });
    }
    const puuid = accountData.puuid;

    // 2. Summoner-v4 호출
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${API_KEY}`);
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. League-v4 호출
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${API_KEY}`);
    const leagueData = await leagueRes.json();
    
    // 배열이 비어있을 수 있으니 안전하게 확인!
    let tierInfo = "UNRANKED";
    let record = "전적 없음";

    if (Array.isArray(leagueData) && leagueData.length > 0) {
        const soloRank = leagueData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
        const flexRank = leagueData.find(entry => entry.queueType === 'RANKED_FLEX_SR');
        const target = soloRank || flexRank;

        if (target) {
            tierInfo = `${target.tier} ${target.rank}`;
            record = `${target.wins}승 ${target.losses}패`;
        }
    }

    // 4. Spectator-v5 호출 (에러나도 중단하지 않음!)
    let gameData = { error: 'not_in_game' };
    try {
        const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
        if (gameRes.ok) {
            const data = await gameRes.json();
            gameData = { ...data, error: null };
        }
    } catch (e) {
        console.log("인게임 아님");
    }

    // 결과 합쳐서 전송!
    res.status(200).json({ ...gameData, puuid, tier: tierInfo, record: record });

  } catch (error) {
    console.error("서버 에러:", error);
    res.status(200).json({ error: 'fetch_failed', tier: "에러발생", record: "확인불가" });
  }
}
