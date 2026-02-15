export default async function handler(req, res) {
  const { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  // [유니] 결과 담을 그릇들
  let tierInfo = "UNRANKED";
  let record = "전적 없음";

  try {
    // 1. Account-v1: PUUID 추출
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
    const accountData = await accountRes.json();
    
    if (!accountData.puuid) {
        return res.status(200).json({ error: 'summoner_not_found', tier: "미검색", record: "닉네임 확인 요망" });
    }
    const puuid = accountData.puuid;

    // 2. Summoner-v4: ID 추출
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${API_KEY}`);
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. League-v4: 전적 데이터 추출 (방어 로직 강화!)
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${API_KEY}`);
    const leagueData = await leagueRes.json();
    
    // [유니] 배열 안을 샅샅이 뒤져서 랭크 타입 상관없이 첫 번째 데이터를 우선 가져와!
    if (Array.isArray(leagueData) && leagueData.length > 0) {
        // 솔로랭크를 최우선으로 찾되, 없으면 아무 랭크 전적이나 가져오기
        const target = leagueData.find(e => e.queueType === 'RANKED_SOLO_5x5') || leagueData[0];
        if (target) {
            tierInfo = `${target.tier} ${target.rank}`;
            record = `${target.wins}승 ${target.losses}패`;
        }
    }

    // 4. Spectator-v5: 실시간 게임 확인 (에러 나도 전적은 보냄)
    let gameData = { error: 'not_in_game' };
    try {
        const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
        if (gameRes.ok) {
            const liveData = await gameRes.json();
            gameData = { ...liveData, error: null };
        }
    } catch (e) {
        // 게임 중이 아님
    }

    res.status(200).json({ ...gameData, puuid, tier: tierInfo, record: record });

  } catch (error) {
    // [유니] 진짜 에러가 났을 때 오빠한테 로그를 알려줘
    res.status(200).json({ error: 'fetch_failed', tier: "에러 발생", record: error.message });
  }
}
