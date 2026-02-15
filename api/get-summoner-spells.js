export default async function handler(req, res) {
  let { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  if (!API_KEY) {
      return res.status(200).json({ error: 'no_key', tier: "설정오류", record: "API 키를 등록해줘!" });
  }

  try {
    // 1. 입력값 정제: 앞뒤 공백 제거 및 태그의 # 제거
    const cleanName = summonerName.trim();
    const cleanTag = tagLine.trim().replace('#', ''); 

    // 2. Account-v1 호출 (가장 중요한 부분!)
    // encodeURIComponent를 써서 "분 구해요" 사이의 공백을 라이엇 서버용으로 바꿨어!
    const accountUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}?api_key=${API_KEY}`;
    
    const accountRes = await fetch(accountUrl);
    const accountData = await accountRes.json();
    
    if (!accountData.puuid) {
        // [유니 팁] 여기서 라이엇이 보내는 진짜 에러 메시지를 확인해보자!
        return res.status(200).json({ 
            error: 'not_found', 
            tier: "미검색", 
            record: accountData.status ? accountData.status.message : "닉네임/태그 재확인 요망" 
        });
    }

    const puuid = accountData.puuid;

    // 3. Summoner-v4 (ID 가져오기)
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${API_KEY}`);
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 4. League-v4 (전적 가져오기)
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${API_KEY}`);
    const leagueData = await leagueRes.json();
    
    let tierInfo = "UNRANKED";
    let record = "전적 없음";

    if (Array.isArray(leagueData) && leagueData.length > 0) {
        const target = leagueData.find(e => e.queueType === 'RANKED_SOLO_5x5') || leagueData[0];
        tierInfo = `${target.tier} ${target.rank}`;
        record = `${target.wins}승 ${target.losses}패`;
    }

    // 5. Spectator-v5 (인게임 확인)
    let gameData = { error: 'not_in_game' };
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
    if (gameRes.ok) {
        const liveData = await gameRes.json();
        gameData = { ...liveData, error: null };
    }

    res.status(200).json({ ...gameData, tier: tierInfo, record: record });

  } catch (error) {
    res.status(200).json({ error: 'server_error', tier: "에러", record: "네트워크 확인" });
  }
}
